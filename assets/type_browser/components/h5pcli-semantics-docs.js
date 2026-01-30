/**
 * Display H5P Semantics JSON in a table sorted by priority
 * Adds documentation links and easy access preview for semantics properties
 *
 * Can not be used as just HTML, must be instantiated in JS.
 *
 * @tagname h5pcli-semantics-docs
 *
 * @example Javascript Instantiation
 * let docs = document.createElement('h5pcli-semantics-docs');
 * await docs.parseSemantics(semanticsJson);
 * this.append(docs);
 */
export default class H5pcliSemanticsDocs extends HTMLElement {

    static semanticsDocUrl = 'https://h5p.org/semantics/'
    // The formally documented types, URL anchors only exist for these
    static semanticTypes = ['text', 'number', 'boolean', 'group', 'list', 'select', 'library', 'image', 'video', 'audio', 'file'];
    // The formally documented attributes, URL anchors only exist for these
    static semanticAttributes = ['name', 'type', 'importance', 'label', 'description', 'optional', 'default', 'common', 'widget', 'widgets', 'field', 'fields', 'max-length', 'regexp', 'enter-mode', 'tags', 'font', 'min', 'max', 'step', 'decimals', 'entity', 'is-sub-content', 'expanded', 'options', 'important'];
    static semanticWidgets = ['textarea', 'html', 'color-selector', 'show-when'];
    static semanticBasicAttributes = H5pcliSemanticsDocs.semanticAttributes.slice(0, 5);

    constructor() {
        super();

        let shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(H5pcliSemanticsDocs.template.content.cloneNode(true));

        this._table = this.shadowRoot.querySelector('table tbody');
        this._previewcontainer = this.shadowRoot.querySelector('#previewcontainer');
    }

    static get template() {
        let tmpl = document.createElement('template');
        tmpl.innerHTML = `
			<style>
            .semantics {
                border-collapse: collapse;
                margin: 20px 0;
                font-size: 18px;
                min-width: 400px;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
            }
            
            .semantics > caption {
                margin: 10px;
                font-size: 24px;
                font-weight: bold;
            }
            
            .semantics th, .semantics td {
                padding: 12px 15px;
                text-align: left;
            }
            
            .semantics > thead tr {
                background-color: #4CAF50;
                color: white;
            }
            
            .semantics > tbody tr:nth-child(odd) {
                background-color: #f2f2f2;
            }
            
            .semantics > tbody tr:nth-child(even) {
                background-color: white;
            }
            
            .semantics > tbody tr:not(.attribute-list):hover {
                background-color: #ddd;
            }
            
            .attribute-list {
                display: none; /* Hidden by default */
                margin-top: 10px;
                /*background-color: #f2f2f2;*/
                padding: 10px;
                border: 1px solid #ddd;
            }
            
            .clickable {
                cursor: pointer;
                color: blue;
                text-decoration: underline;
            }
            .preview {
                cursor: pointer;
                position: relative;
                display: inline;
                margin-left: 10px;
            }
            
            .nested-attributes {
                margin-left: 20px;
            }
            .nested-attributes table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }
    
            .nested-attributes th, .nested-attributes td {
                border: 1px solid #ccc;
                padding: 8px;
                text-align: left;
            }
            
            a[target="_blank"]::after {
                content: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAQElEQVR42qXKwQkAIAxDUUdxtO6/RBQkQZvSi8I/pL4BoGw/XPkh4XigPmsUgh0626AjRsgxHTkUThsG2T/sIlzdTsp52kSS1wAAAABJRU5ErkJggg==);
                margin: 0 3px 0 5px;
            }
            
            #docPreview {
              position: fixed;
              position-anchor: --doc-preview;
              top: calc(anchor(bottom) + 5px);
              justify-self: anchor-center;
              width: 90vw; 
              max-width: 600px;
              height: 200px; /* Height of the iframe */
              border: 5px dotted #1a73d9; /* Border for the iframe */
            }

            .anchor{
                anchor-name: --doc-preview;
            }

			</style>
			
            <table class="semantics">
                <caption>Content Type Semantics and their Attributes</caption>
                <thead>
                    <tr>
                        <th>name</th>
                        <th>type</th>
                        <th>importance</th>
                        <th>label</th>
                        <th>description</th>
                        <th>Other Attributes</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
            <div id="previewcontainer"></div>
			
		`;
        return tmpl;
    }

    connectedCallback() {
    }

    /*
    This is the primary start-render function, must be called with semantics JSON
    Sorts the semantics by the `importance` field then adds to table in alphabetical order
     */
    async parseSemantics(semanticsJson) {
        let groupedMap = Map.groupBy(semanticsJson, ({importance}) => importance);

        this.addRows(groupedMap.get('high') || []);
        this.addRows(groupedMap.get('medium') || []);
        this.addRows(groupedMap.get('low') || []);
        this.addRows(groupedMap.get(undefined) || []);
    }

    /**
     * Helper functions for generating HTML table rows/columns
     */


    addRows(semantics){
        semantics = semantics.sort((a, b) => a.name.localeCompare(b.name));
        for (const field of semantics) {
            this.addRow(field);
        }
    }

    addRow(semantic){
        let row = document.createElement('tr');
        row.innerHTML = `
            <td>${semantic.name}</td>
            <td>${semantic.type}</td>
            <td>${semantic.importance}</td>
            <td>${semantic.label}</td>
            <td>${semantic.description || ''}</td>
        `;
        let col = document.createElement('td');
        col.classList.add('clickable');
        col.id = `${semantic.name}-toggle`;
        col.onclick = ()=>{this.toggleAttributes(semantic.name, col.id)};
        col.textContent = 'Show all';
        row.append(col);

        this._table.append(row);
        this.addAllAttributesRow(semantic)
    }

    addAllAttributesRow(semantic){
        let row = document.createElement('tr');
        row.id = semantic.name;
        row.classList = ['attribute-list'];
        let col = document.createElement('td');
        col.colSpan = 6;

        col.append(this.attributesTable(semantic));
        row.append(col);

        this._table.append(row);
    }

    /**
     * Only the required properties for a given semantic are shown in the initial table
     * This is an expanded view of all the properties for a semantic, including a recursive call to their sub-properties
     *
     * @param semantic a single semantic field from the semantics.json
     * @returns {HTMLTableElement}
     */
    attributesTable(semantic){
        let table = document.createElement('table');
        table.classList.add('nested-attributes');

        for (const [att, val] of Object.entries(semantic)) {
            // if(H5pcliSemanticsDocs.semanticBasicAttributes.includes(att)){continue;}
            let tr = document.createElement('tr');
            let nameRow = document.createElement('td');
            let typeRow = document.createElement('td');
            let valueRow = document.createElement('td');
            tr.append(nameRow);
            // tr.append(typeRow);
            tr.append(valueRow);

            let attUrl = this.attributeUrl(att);
            if(attUrl){
                nameRow.innerHTML = `<a href="${attUrl}" target="_blank">${att}</a>`;
                let div = document.createElement('div');
                div.innerHTML = "&#128269;";
                div.classList.add('preview');
                div.onclick = ()=>{this.toggleDocsFrame(div, attUrl)};
                nameRow.append(div);
            } else {
                nameRow.textContent = att;
            }

            typeRow.innerHTML = typeof val;

            if(typeof val === 'object' || typeof val === 'array'){
                valueRow.append(this.attributesTable((val)));
            } else {
                valueRow.textContent = val;
            }

            table.append(tr);
        }
        return table;
    }

    /**
     * Callback function for the documentation preview icon.
     * If an documentation iframe is open it will be closed
     *
     * For the chosen property open a preview url to the h5p.org documentation site
     *
     * @param parent
     * @param url
     */
    toggleDocsFrame(parent, url){
        let oldAnchor = this.shadowRoot.querySelector('.anchor');
        let iframe = this.shadowRoot.getElementById('docPreview');
        if(iframe){
            oldAnchor.classList.remove('anchor');
            iframe.remove();
        }

        if(parent !== oldAnchor){
            iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.id = 'docPreview';
            this._previewcontainer.append(iframe);
            parent.classList.add('anchor');
        }
    }

    /**
     * Callback function for the Show All column
     * Shows or hides the Attribute Table for the given semantic row
     * @param id
     * @param toggleId
     */
    toggleAttributes(id, toggleId){
        let row = this.shadowRoot.getElementById(id);
        let toggler = this.shadowRoot.getElementById(toggleId);
        if (row.style.display === "none" || row.style.display === "") {
            row.style.display = "table-row";
            toggler.textContent = "Hide all";
        } else {
            row.style.display = "none";
            toggler.textContent = "Show all";
        }
    }


    /**
     * URL helpers for documentation links
     * These make sure the type/attribute/widget exist before return a URL
     */


    typeUrl(typeName){
        if(H5pcliSemanticsDocs.semanticTypes.includes(typeName)){
            return `${H5pcliSemanticsDocs.semanticsDocUrl}#type-${typeName}`;
        } else {
            return null;
        }
    }

    attributeUrl(attName){
        //todo check camelcase?
        if(H5pcliSemanticsDocs.semanticAttributes.includes(attName)){
            return `${H5pcliSemanticsDocs.semanticsDocUrl}#attribute-${attName}`;
        } else {
            return null;
        }
    }

    widgetUrl(widgetName){
        //todo check camelcase?
        if(H5pcliSemanticsDocs.semanticWidgets.includes(widgetName)){
            return `${H5pcliSemanticsDocs.semanticsDocUrl}#widget-${widgetName}`;
        } else {
            return null;
        }
    }



}

if( !customElements.get('h5pcli-semantics-docs')){
    customElements.define('h5pcli-semantics-docs', H5pcliSemanticsDocs);
}
