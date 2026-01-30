/**
 * Display xAPI events in collapsed details nodes
 * Each event is displayed with a human-readable summary for  {actor} {action} {object}
 *
 * If in listen mode (default): Listen for xAPI events from the H5P.externalDispatcher and render on page
 * If in nolisten mode: Only display xAPI events
 *
 * @attribute {bool} open - The list of captured events is closed by default, adding this attribute will start it open
 * @attribute {bool} float - Enable the list renders _over_ the surrounding content
 * @attribute {bool} nolisten - Don't listen for H5P events, they can still be added manually
 *
 * @slot events - Slot for added events
 *
 * @example HTML Usage - Capture events on an H5P View page and when expanded, float content over page
 * <h5pcli-xapi-viewer float></h5pcli-xapi-viewer>
 *
 * @example Javascript Instantiation with existing list of events
 * let viewer = document.createElement('h5pcli-xapi-viewer');
 * viewer.setAttribute("nolisten", "nolisten");
 * viewer.setAttribute("open", "open");
 * this.append(viewer);
 *
 * for (const event of xAPIJsonExamplesArray) {
 *     viewer.createSummaryAndAdd(event);
 * }
 *
 * @tag h5pcli-xapi-viewer
 * @tagname h5pcli-xapi-viewer
 */
export default class H5pcliXapiViewer extends HTMLElement {
    static get observedAttributes() {
        return ["open", "float", "nolisten"];
    }

    constructor() {
        super();

        let shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(H5pcliXapiViewer.template.content.cloneNode(true));

        this._summary = this.shadowRoot.querySelector('summary');
        this._list = this.shadowRoot.querySelector('.list');
        this._content = this.shadowRoot.querySelector('.content');

        this._listening = false;

        this.preProcessEvent = this.preProcessEvent.bind(this)
    }

    static get template() {
        let tmpl = document.createElement('template');
        tmpl.innerHTML = `
			<style>
			    .list {
                  padding: 10px; 
                  /*background-color: #e2e5ee;*/
                  border: 1px solid #e2e5ee;
                  border-radius: 3px;
                }
                .list .content{
                    width: 100%;
                    padding: 1em;
                    max-height: 80vh;
                    overflow: auto;
                }
                .float{
                    position: absolute;
                    background-color: black;
                }
                :host([open]) > .list[open] > summary{
                  list-style: none;
                }
                :host([open]) > .list:not(open) > summary{
                  list-style: revert;
                }
                ::slotted(.slotted-details){
                    padding: 5px !important;
                    font-family: monospace !important;
                    font-size: x-large !important;
                    cursor: pointer;
                }
			</style>
			<details class="list">
              <summary>xAPI Events</summary>
              <div class="content">
                <slot name="events"></slot>
              </div>
            </details>
            
		`;
        return tmpl;
    }

    connectedCallback() {
        this.setXapiListener();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if(name === "open"){
            if(newValue === null){
                this._list.removeAttribute("open");
            } else {
                this._list.setAttribute("open", 'open');
            }
        }
        if(name === "float"){
            if(newValue === null){
                this._content.classList.remove("float");
            } else {
                this._content.classList.add("float");
            }
        }
        if(name === "nolisten"){
            this.setXapiListener();
        }

    }

    setXapiListener(){
        if(!this.hasAttribute("nolisten") && typeof H5P !== 'undefined'){
            H5P.externalDispatcher.on('xAPI', this.preProcessEvent);
        } else if (typeof H5P !== 'undefined') {
            H5P.externalDispatcher.off('xAPI', this.preProcessEvent);
        }
    }

    preProcessEvent(event){
        this.createSummaryAndAdd(event.data.statement);
    }

    /**
     * Create a human-readable summary for {actor} {action} {object} {score/result summary}
     * @param statement
     */
    createSummaryAndAdd(statement) {
        let summary = "Example Event";
        try {
            let user = statement.actor.name;
            let verb = statement.verb.id.split('/').pop();
            let object = statement.object.id.split('/').pop();
            let result = '';

            if (statement.object.definition?.name?.['en-US']) {
                object = statement.object.definition.name['en-US'];
            }

            if (statement.result) {
                let res = statement.result;
                if("success" in res){
                    result = res.success ? "correct" : "incorrect";
                }
                if(res.score){
                    result += ` (${res.score.raw}/${res.score.max})`;
                }
                if(result){
                    result = ` - (${result})`;
                }
            }

            summary = `${user} "${verb}" ${object} ${result}`;
        } catch (e) {
            console.log("Error creating summary for event. ", e, statement);
        }
        this.addEvent(summary, statement);
    }

    /**
     * Add the given short summary with a collapsed details node of the actual xAPI JSON object
     *
     * @param shortStatement
     * @param jsonStringOrObj
     */
    addEvent(shortStatement, jsonStringOrObj){
        if(!jsonStringOrObj){return;}
        let json_parsed;

        try{
            json_parsed = (typeof jsonStringOrObj === 'string') ? JSON.parse(jsonStringOrObj) : jsonStringOrObj;
        } catch(err) {
            console.log("Error parsing json", err, json_parsed)
            return;
        }

        let details = document.createElement('details')
        details.slot = "events";
        details.setAttribute("class", "slotted-details")
        let summary = document.createElement('summary')
        summary.textContent = shortStatement;
        details.append(summary);
        let pre = document.createElement('pre');
        let code = document.createElement('code')
        code.setAttribute("class", "language-json")
        code.textContent = JSON.stringify(json_parsed, undefined, 2)
        pre.append(code);

        details.append(pre)
        this.append(details);

        if(typeof hljs !== "undefined"){
            try{hljs.highlightElement(code);} catch {console.log("hljs loaded, but failed to highlight xapi event.")}
        }

        let count = this.querySelectorAll("details").length;
        this._summary.textContent = `xAPI Events (${count})`
    }
}

if( !customElements.get("h5pcli-xapi-viewer")){
    customElements.define('h5pcli-xapi-viewer', H5pcliXapiViewer);
}
