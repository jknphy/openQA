// jshint esversion: 6

function createElement(tag, content = [], attrs = {}) {
    let elem = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined) {
            elem.setAttribute(key, value);
        }
    }

    for (let idx in content) {
        let val = content[idx];

        if ((typeof val) === 'string') {
            val = document.createTextNode(val);
        }

        elem.appendChild(val);
    }

    return elem;
}

function renderTemplate(template, args = {}) {
    for (let key in args) {
        template = template.split('$' + key + '$').join(args[key]);
        template = template.split(encodeURIComponent('$' + key + '$'));
        template = template.join(encodeURIComponent(args[key]));
    }

    return template;
}

function moduleResultCSS(result) {
    let resmap = {
        na: '',
        incomplete: '',
        softfailed: 'resultsoftfailed',
        passed: 'resultok',
        running: 'resultrunning'
    };

    if (!result) {
        return 'resultunknown';
    } else if (result.substr(0, 4) === 'fail') {
        return 'resultfailed';
    } else if (resmap[result] !== undefined) {
        return resmap[result];
    }

    return 'resultunknown';
}

function renderModuleRow(module, snippets) {
    let E = createElement;
    let rowid = 'module_' + module.name.replace(/[^a-z0-9_-]+/ig, '-');
    let flags = [];
    let stepnodes = [];

    if (module.execution_time) {
        flags.push(E('span', [module.execution_time]));
        flags.push('\u00a0');
    }

    if (module.flags.indexOf('fatal') >= 0) {
        flags.push(E('i', [], {
            'class': 'flag fa fa-plug',
            title: 'Fatal: testsuite is aborted if this test fails'
        }));
    } else if (module.flags.indexOf('important') < 0) {
        flags.push(E('i', [], {
            'class': 'flag fa fa-minus',
            title: 'Ignore failure: failure or soft failure of this test does not impact overall job result'
        }));
    }

    if (module.flags.indexOf('milestone') >= 0) {
        flags.push(E('i', [], {
            'class': 'flag fa fa-anchor',
            title: 'Milestone: snapshot the state after this test for restoring'
        }));
    }

    if (module.flags.indexOf('always_rollback') >= 0) {
        flags.push(E('i', [], {
            'class': 'flag fa fa-redo',
            title: 'Always rollback: revert to the last milestone snapshot even if test module is successful'
        }));
    }

    let src_url = renderTemplate(snippets.src_url, { MODULE: encodeURIComponent(module.name) });
    let component = E('td', [
        E('div', [E('a', [module.name], { href: src_url })]),
        E('div', flags, { 'class': 'flags' })
    ], { 'class': 'component' });

    let result = E('td', [module.result], { 'class': 'result ' + moduleResultCSS(module.result) });

    for (let idx in module.details) {
        let step = module.details[idx];
        let title = step.display_title;
        let href = '#step/' + module.name + '/' + step.num;
        let tplargs = { MODULE: encodeURIComponent(module.name), STEP: step.num };
        let alt = '';

        if (step.name) {
            alt = step.name;
        }

        if (step.is_parser_text_result || title === 'wait_serial') {
            const elements = [];
            if (!step.is_parser_text_result) {
                const previewLimit = 250;
                let shortText = step.text_data.replace(/.*# Result:\n?/s, '');
                if (shortText.length > previewLimit) {
                    shortText = shortText.substr(0, previewLimit) + '…';
                }
                const stepFrame = E('span', [shortText], { 'class': 'resborder ' + step.resborder });
                const serialPreview = E('span', [stepFrame], {
                    title: shortText,
                    'data-href': href,
                    'class': 'serial-result-preview',
                    onclick: 'toggleTextPreview(this)'
                });
                elements.push(serialPreview);
            }
            const stepActions = E('span', [], { 'class': 'step_actions' });
            stepActions.innerHTML = renderTemplate(snippets.bug_actions, { MODULE: module.name, STEP: step.num });
            const stepFrame = E('span', [stepActions, step.text_data], { 'class': 'resborder ' + step.resborder });
            const textResult = E('span', [stepFrame], {
                title: step.is_parser_text_result ? title : undefined,
                'data-href': href,
                'class': 'text-result',
                onclick: 'toggleTextPreview(this)'
            });
            elements.push(textResult);
            stepnodes.push(E('div', elements, { 'class': 'links_a ' + (step.is_parser_text_result ? 'external-result-container' : 'serial-result-container') }));
            continue;
        }

        let url = renderTemplate(snippets.module_url, tplargs);
        let resborder = step.resborder;
        let box = [];

        if (step.screenshot) {
            let thumb;

            if (step.md5_dirname) {
                thumb = renderTemplate(snippets.md5thumb_url, { DIRNAME: step.md5_dirname, BASENAME: step.md5_basename });
            } else {
                thumb = renderTemplate(snippets.thumbnail_url, { FILENAME: step.screenshot });
            }

            if (step.properties &&
                step.properties.indexOf('workaround') >= 0) {
                resborder = 'resborder_softfailed';
            }

            box.push(E('img', [], {
                width: 60,
                height: 45,
                src: thumb,
                alt: alt,
                'class': 'resborder ' + resborder
            }));
        } else if (step.audio) {
            box.push(E('span', [], {
                alt: alt,
                'class': 'icon_audio resborder ' + resborder
            }));
        } else if (step.text) {
            box.push(E('span', [step.title ? step.title : 'Text'], { 'class': 'resborder ' + resborder }));
        } else {
            let content = step.title;

            if (!content) {
                content = E('i', [], { 'class': 'fas fa fa-question' });
            }

            box.push(E('span', [content], { 'class': 'resborder ' + resborder }));
        }

        const link = E('a', box, {
            'class': 'no_hover',
            'data-url': url,
            title: title,
            href: href,
        });
        link.onclick = function() {
            setCurrentPreview($(this).parent()); // show the preview when clicking on step links
            return false;
        };
        stepnodes.push(E('div', [E('div', [], { 'class': 'fa fa-caret-up' }), link], { 'class': 'links_a' }));
        stepnodes.push(' ');
    }

    let links = E('td', stepnodes, { 'class': 'links' });
    return E('tr', [component, result, links], { id: rowid });
}

function renderModuleTable(container, response) {
    container.innerHTML = response.snippets.header;

    if (response.modules === undefined || response.modules === null) {
        return;
    }

    let E = createElement;
    let thead = E('thead', [E('tr', [
        E('th', ['Test']),
        E('th', ['Result']),
        E('th', ['References'], { style: 'width: 100%' })
    ])]);
    let tbody = E('tbody');

    container.appendChild(E('table', [thead, tbody], { id: 'results', 'class': 'table table-striped' }));

    for (let idx in response.modules) {
        let module = response.modules[idx];

        if (module.category) {
            tbody.appendChild(E('tr', [E('td', [
                E('i', [], { 'class': 'fas fa-folder-open' }),
                '\u00a0' + module.category
            ], { colspan: 3 })]));
        }

        tbody.appendChild(renderModuleRow(module, response.snippets));
    }
}