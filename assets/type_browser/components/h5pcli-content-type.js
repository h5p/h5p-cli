/**
 * Display an H5P Content Type's Library, Semantics, and xAPI examples
 * Can be displayed collapsed for an index page, or expanded
 *
 * Expects an "augmented library" JSON block like this:
 * {
 * "links_data": {
 *      "library": "/libraries/H5P.TrueFalse-1.8/library.json",
 *      "xapi_examples": "/type_browser/H5P.TrueFalse-1.8/xapi_examples",
 *      "semantics": "/libraries/H5P.TrueFalse-1.8/semantics.json"
 *  },
 * "links_web": {
 *      "docPage": "/type_browser/H5P.TrueFalse-1.8/",
 *      "fixtures": "/libraries/H5P.TrueFalse-1.8/tests/fixtures"
 *  },
 * "icon_url": "/libraries/H5P.TrueFalse-1.8/icon.svg",
 * "library": { ... Typical H5P Library ... }
 * }
 *
 * @attribute {string} src - Optional path to the augmented library json definition for the type
 * @attribute {string} collapsed - Optional Displays just the title and links with the Library, Semantics, and xAPI sections hidden within details tabs.
 *
 * @slot title - Title slot, filled with the type title and version number by default
 * @slot details - Slots for the content tabs for Library, Semantics, and xAPI. Light-dom enables js-highlight script to see it
 *
 * @tagname h5pcli-content-type
 *
 * @example HTML Usage
 * <h5pcli-content-type class="item" src="./library.json"></h5pcli-content-type>
 *
 * @example Javascript Instantiation
 * let type = document.createElement('h5pcli-content-type');
 * type.setAttribute("collapsed", "");
 * type.renderFromAugmentedLibrary(lib);
 * this.append(type);
 *
 */
export default class H5pcliContentType extends HTMLElement {
    static observedAttributes = ['src'];

    constructor() {
        super();

        let shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(H5pcliContentType.template.content.cloneNode(true));

        this.contentType = null;

        this._slot_links = this.shadowRoot.querySelector('ul[name="links"]');
        this._tabs = this.shadowRoot.querySelector('.tabs-container');
        this._icon = this.shadowRoot.querySelector('.itemIcon img');
        this._docLink = this.shadowRoot.querySelector('.doc-link');
        this._memoizedSearch = {
            title: null,
            dependencies: null
        };
    }

    static get template() {
        let tmpl = document.createElement('template');
        tmpl.innerHTML = `
			<style>
                li {
                    display: inline;
                    padding: 1rem;
                }
                .itemIcon {
                    display: inline-block;
                    flex-basis: 5%;
                    pointer-events: auto;
                    padding: 0 0.5em 0 1.5em;
                }
                .item {
                    pointer-events: auto;
                    flex-basis: 65%;
                    padding-left: 1em;
                }
                .item slot[name=title]{
                    font-size: 1.25em;
                    font-weight: 600;
                    display: inline;
                }
                .doc-link {
                    text-decoration: unset;
                    padding-left: 1rem;
                }
                :host(:not([collapsed])) .doc-link {
                    display: none;
                }
                :host([collapsed]) .tabs-container {
                  position: relative;
                  display: grid;
                  grid-template-rows: auto 1fr;
                  grid-template-columns: repeat(3, auto);
                  width: 90%;
                  margin-top: 10px;
                }
			</style>
			    <div class="itemIcon"><img src="/assets/icon.svg"></div>
			    <div class="item">
		            <slot name="title"></slot>
		            <span class="doc-link"></span>
		            <ul name="links"></ul>
                    <div class="tabs-container">
                        <slot name="details"></slot>
                    </div>
                </div>
		`;
        return tmpl;
    }

    /*
    The proper layout of tabs depends on the correct count, call this to change from the default 3 tabs
     */
    setTabColumns(count=3){
        this._tabs.style.gridTemplateColumns = `repeat(${count}, auto)`
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if(name === 'src'){
            this.fetchSrcUpdate(newValue);
        }
    }

    async fetchSrcUpdate(src) {
        try {
            const response = await fetch(src);
            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }

            const json = await response.json();
            this.renderFromAugmentedLibrary(json);
        } catch (error) {
            console.error(error.message);
        }
    }

    isRunnable(){
        return this.contentType.library.runnable === 1;
    }

    matchesSearch(searchString, includeDependencies = false) {
        if (this._memoizedSearch.title === null) {
            this._memoizedSearch.title = this.contentType.library.title.toLowerCase();
        }
        let searchLowered = searchString.toLowerCase();

        const titleMatch = this._memoizedSearch.title.includes(searchLowered);

        if (includeDependencies) {
            return titleMatch || this.matchesDependencies(searchLowered);
        }

        return titleMatch;
    }

    matchesDependencies(searchLowered){
        if (this._memoizedSearch.dependencies === null) {
            this._memoizedSearch.dependencies = [
                ...(this.contentType.library.preloadedDependencies || []).map(dep => dep.machineName.toLowerCase()),
                ...(this.contentType.library.editorDependencies || []).map(dep => dep.machineName.toLowerCase())
            ];
        }

        return this._memoizedSearch.dependencies.some(dep => dep.includes(searchLowered));
    }

    /*
    Takes an Augmented Library object (from src attribute or directly)
    Parses Title and version number, adds classes for runnable and notrunnable, sets the icon,
    adds tabs for h5pcli-library-overview, h5pcli-semantics, and h5pcli-xapi-examples
    and adds links for any values in the `links_web` property
     */
    renderFromAugmentedLibrary(jsonStringOrObj){
        if(!jsonStringOrObj){return;}
        let json_parsed;

        try{
            json_parsed = (typeof jsonStringOrObj === 'string') ? JSON.parse(jsonStringOrObj) : jsonStringOrObj;
        } catch(err) {
            console.log("Error parsing H5P Library json", err, json_parsed)
            return;
        }

        this.contentType = json_parsed;
        let library = this.contentType.library
        if(library.title){
            let title = document.createElement('span');
            let version = `v${library.majorVersion}.${library.minorVersion}.${library.patchVersion}`
            title.textContent = `${library.title} - ${version}`;
            title.slot = "title";
            this.append(title);
        }

        if(this.isRunnable()){
            this.classList.add('runnable');
        } else {
            this.classList.add('notrunnable');
        }

        if(this.contentType.icon_url){
            this._icon.src = this.contentType.icon_url;
        }

        let libraryOverview = document.createElement('h5pcli-library-overview');
        libraryOverview.parseLibrary(library);
        this.addContentTab( "Library Information", libraryOverview);

        if(this.contentType.links_data){
            if(this.contentType.links_data['semantics']){
                let semantics = document.createElement('h5pcli-semantics');
                semantics.src = this.contentType.links_data['semantics'];
                this.addContentTab( "Semantics", semantics);
            } else if (this.isRunnable()) {
                let message = document.createElement('p');
                message.textContent = `No semantics.`;
                this.addContentTab("(No Semantics)", message);
            }

            if(this.contentType.links_data['xapi_examples']){
                let examples = document.createElement('h5pcli-xapi-examples');
                examples.src = this.contentType.links_data['xapi_examples'];
                this.addContentTab( "xAPI Events", examples);
            } else if (this.isRunnable()){
                let message = document.createElement('p');
                message.innerHTML = `No examples for this type. Add them to <code>/${library.machineName}/events/xapi/examples/</code> to view here.`;
                this.addContentTab("xAPI Events", message);
            }
        }

        // links to new pages
        if(this.contentType.links_web){
            for (const [link, path] of Object.entries(this.contentType.links_web)) {
                if(link === 'docPage'){
                    let link = document.createElement('a');
                    link.href = this.contentType.links_web.docPage;
                    link.textContent = 'Full Docs';
                    this._docLink.append(link);
                } else {
                    let li = document.createElement('li')
                    let aref = document.createElement('a')
                    aref.href = path;
                    aref.textContent = link;
                    // aref.target = "_blank";
                    li.append(aref);
                    this._slot_links.append(li);
                }
            }
        }
    }


    addContentTab(title, node){
        let div = document.createElement('div');
        div.append(node);

        this.addDetails(title, div);
    }

    addDetails(title, content){
        let details = document.createElement('details')
        if(this.hasAttribute('collapsed')){
            details.name = "details";
        } else {
            details.setAttribute("open", "");
        }
        details.slot = "details";
        let summary = document.createElement('summary');
        summary.textContent = title;
        details.append(summary);
        content.setAttribute("class", "tab-content")
        details.append(content);
        this.append(details);
    }

}

if( !customElements.get('h5pcli-content-type')){
    customElements.define('h5pcli-content-type', H5pcliContentType);
}
