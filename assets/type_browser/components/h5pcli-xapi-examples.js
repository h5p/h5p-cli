/**
 * A wrapper component for h5pcli-xapi-viewer to populate it pre-saved xAPI examples
 * It will defer fetching the events until visible, and disables the h5pcli-xapi-viewer instance from listening for new events
 *
 * @attribute {string} src - The optional API endpoint that returns an array of example xAPI events. Fetching events is deferred until the element is visible.
 *
 * @slot viewer - The slot for the h5pcli-xapi-viewer which will be added with the attributes: open, nolisten
 *
 * @tag h5pcli-xapi-examples
 * @tagname h5pcli-xapi-examples
 *
 * @example HTML Usage
 * <h5pcli-xapi-examples src="./examples.json"></h5pcli-xapi-examples>
 *
 * @example Javascript Instantiation
 * let examples = document.createElement('h5pcli-xapi-examples');
 * examples.src = "./examples.json";
 * this.append(examples);
 */
export default class H5pcliXapiExamples extends HTMLElement {
    constructor() {
        super();

        let shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(H5pcliXapiExamples.template.content.cloneNode(true));

        this._loaded = false;
    }

    static get template() {
        let tmpl = document.createElement('template');
        tmpl.innerHTML = `
			<style>
			</style>
			<slot name="viewer">Loading...</slot>
		`;
        return tmpl;
    }

    /*
    * Use an IntersectionObserver to detect when the element is visible
    * once visible, it will stop observing and asynchronously fetch and load the src data
    */
    connectedCallback() {
        // delay fetching the xapi events until visible
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        if(this.src){
                            this.fetchAndListEvents();
                        }
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                root: this.parentNode
            }
        );

        observer.observe(this);
    }

    get src() {
        return this.getAttribute('src');
    }
    set src(val) {
        this.setAttribute('src', val);
    }

    /*
    * If the h5pcli-xapi-viewer element exists, fetch the src data and populate that component
    * with all the xAPI events from the src call.
    * The h5pcli-xapi-viewer element is set to nolisten mode.
    */
    async fetchAndListEvents() {
        if(!customElements.get('h5pcli-xapi-viewer')) throw("Required component h5pcli-xapi-viewer not loaded");
        if(this._loaded){return};
        this._loaded = true;

        let res = await this.fetchEvents();
        let viewer = document.createElement('h5pcli-xapi-viewer');
        viewer.slot = "viewer";
        viewer.setAttribute("nolisten", "nolisten");
        viewer.setAttribute("open", "open");
        this.append(viewer);

        for (const event of res['xapiExamples']) {
            viewer.createSummaryAndAdd(event);
        }
    }

    async fetchEvents() {
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

if( !customElements.get('h5pcli-xapi-examples')){
    customElements.define('h5pcli-xapi-examples', H5pcliXapiExamples);
}
