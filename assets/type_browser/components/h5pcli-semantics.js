/**
 * Fetch an H5P Semantics JSON url and display in table form and JSON preview
 * Will not fetch the URL until this element is visible on the page
 * Uses the h5pcli-semantics-docs component for table display
 *
 * @attribute {string} src - URL to an H5P semantics JSON
 *
 * @slot viewer - The slot for the table displaying the semantics with h5pcli-semantics-docs
 * @slot json - Slot for JSON preview
 *
 * @tagname h5pcli-semantics
 *
 * @example HTML Usage
 * <h5pcli-semantics src="/library/type/semantics.json"></h5pcli-semantics>
 *
 * @example Javascript Instantiation
 * let semantics = document.createElement('h5pcli-semantics');
 * semantics.src = '/content_type/semantics_url.json';
 * this.append(semantics);
 *
 */
export default class H5pcliSemantics extends HTMLElement {
    constructor() {
        super();

        let shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(H5pcliSemantics.template.content.cloneNode(true));

        this._loaded = false;
    }

    static get template() {
        let tmpl = document.createElement('template');
        tmpl.innerHTML = `
			<style>
			</style>
			<slot name="viewer">Loading documentation</slot>
			<slot name="json">Loading json</slot>
		`;
        return tmpl;
    }

    /*
    Use an IntersectionObserver to only fetch src when visible, then stop listening
     */
    connectedCallback() {
        // delay fetching the until visible
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        if(this.src){
                            this.fetchAndDisplay();
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
    After fetching json render in h5pcli-semantics-docs and display preview JSON
     */
    async fetchAndDisplay() {
        if(this._loaded){return};
        this._loaded = true;

        let semanticsJson = await this.fetchSemantics();

        let docs = document.createElement('h5pcli-semantics-docs');
        docs.slot = "viewer";
        await docs.parseSemantics(semanticsJson);
        this.append(docs);

        let details = document.createElement('details');
        details.slot = "json";
        let summary = document.createElement('summary');
        summary.textContent = "Semantics JSON";
        details.append(summary);
        let pre = document.createElement('pre');
        let code = document.createElement('code')
        code.setAttribute("class", "language-json")
        code.textContent = JSON.stringify(semanticsJson, undefined, 2)
        details.append(pre);
        pre.append(code);

        this.append(details);

        if(typeof hljs !== "undefined"){
            try{hljs.highlightElement(code);} catch {console.log("hljs loaded, but failed to highlight xapi event.")}
        }
    }

    async fetchSemantics() {
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

if( !customElements.get('h5pcli-semantics')){
    customElements.define('h5pcli-semantics', H5pcliSemantics);
}
