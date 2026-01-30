/**
 * Render a filterable index of H5P Content Types
 * Each type is displayed as a h5pcli-type-browser
 *
 * Provides search for library titles and filtering for runnable/notrunnable types
 *
 * @attribute {string} src - Endpoint of Augmented Library JSON
 *
 * @slot library - Each library will be slotted into the light dom
 *
 * @tagname h5pcli-type-browser
 *
 * @example HTML Usage
 * <h5pcli-type-browser src="/type_browser/installed_libraries"></h5pcli-type-browser>
 *
 */
export default class H5pcliTypeBrowser extends HTMLElement {
    static filteredClassName = 'filteredout';
    //Filter localStorage keys
    static runnableFilterState = "h5pcli-filter-runnable";
    static notrunnableFilterState = "h5pcli-filter-notrunnable";
    static showDependencyState = "h5pcli-filter-show-dependencies";
    static searchState = "h5pcli-filter-search-value";

    constructor() {
        super();

        let shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(H5pcliTypeBrowser.template.content.cloneNode(true));

        this._searchInput = this.shadowRoot.querySelector('#search-input');
        this._dependencyToggle = this.shadowRoot.querySelector('#include-dependencies');
        this._runnableToggle = this.shadowRoot.querySelector('#runnable-toggle');
        this._notrunnableToggle = this.shadowRoot.querySelector('#notrunnable-toggle');
        this._slottedLibraries = [];
        this.applyFilters = this.applyFilters.bind(this)
    }

    static get template() {
        let tmpl = document.createElement('template');
        tmpl.innerHTML = `
			<style>
			::slotted(.${H5pcliTypeBrowser.filteredClassName}){
			    display: none !important;
			}
            #search-container {
              display: grid;
              grid-template-columns: 1fr auto auto;
              gap: 10px;
              margin-bottom: 10px;
            }
            #search-input {
              grid-column: 1 / 2;
              width: 100%;
              padding: 8px;
              box-sizing: border-box;
            }
            #search-options {
              grid-column: 1 / 4;
              display: flex;
              gap: 15px;
              align-items: center;
              margin-top: 5px;
            }
            .filters {
              display: flex;
              align-items: center;
              gap: 5px;
            }
			</style>
			
			<div id="search-container">
                <input type="text" id="search-input" placeholder="Search libraries...">

                <div id="search-options">
                    <div>
                        <input type="checkbox" id="include-dependencies">
                        <label for="include-dependencies">Include Dependencies</label>
                    </div>
            
                    <div class="filters">
                        <span class="section-label">Filters:</span>
                        <div>
                            <input type="checkbox" id="runnable-toggle" checked>
                            <label for="runnable-toggle">Show Runnable</label>
                        </div>
                        <div>
                            <input type="checkbox" id="notrunnable-toggle">
                            <label for="notrunnable-toggle">Show not-runnable</label>
                        </div>
                    </div>
                </div>
            </div>
			

			<slot name="library">Loading...</slot>
		`;
        return tmpl;
    }

    connectedCallback() {
        this.restoreFilterState();
        [this._runnableToggle, this._notrunnableToggle, this._dependencyToggle, this._searchInput].forEach((elem) =>{
            elem.addEventListener(elem.type === 'text' ? 'input' : 'change', (e)=>{
                this.saveFilterState();
                this.applyFilters();
            });
        });
    }
    disconnectedCallback(){
        [this._runnableToggle, this._notrunnableToggle, this._dependencyToggle, this._searchInput].forEach((elem) =>{
            elem.removeAllListeners();
        });
    }

    /*
    Set visible libraries for current search and filter options
     */
    async applyFilters(){
        let searchVal = this._searchInput.value;

        this._slottedLibraries.forEach((lib) => {
            let visible = false;

            if(lib.isRunnable()){
                visible = this._runnableToggle.checked;
            } else {
                visible = this._notrunnableToggle.checked;
            }

            // it wasn't filtered out, do search string
            if(visible && searchVal.length > 0){
                visible = lib.matchesSearch(searchVal, this._dependencyToggle.checked);
            }

            if(visible){
                lib.classList.remove(H5pcliTypeBrowser.filteredClassName);
            } else {
                lib.classList.add(H5pcliTypeBrowser.filteredClassName);
            }
        });
    }

    saveFilterState(){
        localStorage.setItem(H5pcliTypeBrowser.runnableFilterState, this._runnableToggle.checked);
        localStorage.setItem(H5pcliTypeBrowser.notrunnableFilterState, this._notrunnableToggle.checked);
        localStorage.setItem(H5pcliTypeBrowser.showDependencyState, this._dependencyToggle.checked);
        localStorage.setItem(H5pcliTypeBrowser.searchState, this._searchInput.value);
    }

    restoreFilterState(){
        this._runnableToggle.checked = JSON.parse(localStorage.getItem(H5pcliTypeBrowser.runnableFilterState)) ?? true;
        this._notrunnableToggle.checked = JSON.parse(localStorage.getItem(H5pcliTypeBrowser.notrunnableFilterState)) ?? false;
        this._dependencyToggle.checked = JSON.parse(localStorage.getItem(H5pcliTypeBrowser.showDependencyState)) ?? false;
        this._searchInput.value = localStorage.getItem(H5pcliTypeBrowser.searchState) ?? "";
    }

    // Invoked when component attribute changes
    attributeChangedCallback(attrName, oldVal, newVal) {
        if (attrName === 'src') {
            this.fetchAndListLibraries();
        }
    }

    static get observedAttributes() {
        return ['src'];
    }

    get src() {
        return this.getAttribute('src');
    }
    set src(val) {
        this.setAttribute('src', val);
    }


    /*
    Add a collapsed h5pcli-content-type for each library to the library slot
     */
    async fetchAndListLibraries() {
        if(!customElements.get('h5pcli-content-type')) throw("Required component h5pcli-content-type not loaded");

        let res = await this.fetchLibraries();

        for (const [name, lib] of Object.entries(res)) {
            let type = document.createElement('h5pcli-content-type');
            type.setAttribute("class", "item");
            type.setAttribute("collapsed", "");
            type.slot = "library";
            type.renderFromAugmentedLibrary(lib);
            this.append(type);
        }

        this._slottedLibraries = this.shadowRoot.querySelector('slot[name="library"]').assignedElements({ flatten: true });
        this.applyFilters();
    }

    async fetchLibraries() {
        try {
            const response = await fetch(this.src);
            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }

            const json = await response.json();
            return json;
        } catch (error) {
            console.error(error.message);
        }
    }

}

if( !customElements.get('h5pcli-type-browser')){
    customElements.define('h5pcli-type-browser', H5pcliTypeBrowser);
}
