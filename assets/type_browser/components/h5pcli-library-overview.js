/**
 * Display a parsed overview of an H5P Library and embed the JSON for display
 * Can not be used as just HTML, must be instantiated in JS.
 *
 * The attributes are parsed into a shadow-dom table for display
 *
 * @slot json - You can put some elements here
 *
 * @tagname h5pcli-library-overview
 *
 * @example Javascript Instantiation
 * let libraryOverview = document.createElement('h5pcli-library-overview');
 * libraryOverview.parseLibrary(libraryJson);
 * this.append(libraryOverview);
 *
 */
export default class H5pcliLibraryOverview extends HTMLElement {

    constructor() {
        super();

        let shadowRoot = this.attachShadow({mode: 'open'});
        shadowRoot.appendChild(H5pcliLibraryOverview.template.content.cloneNode(true));

        this.description = this.shadowRoot.querySelector('.description');
    }

    static get template() {
        let t = document.createElement('template')
        t.innerHTML = `
        <style>
        .overview{
            display: flex;
            gap: 20px;
            margin-bottom: 10px;
            align-items: flex-start;
        }
        table {
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 18px;
            max-width: 45%;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
        }
        
        table > caption {
            margin: 10px;
            /*font-size: 24px;*/
            font-weight: bold;
        }
        
        table th, table td {
            padding: 12px 15px;
            text-align: left;
        }
        
        table > thead tr {
            background-color: #4CAF50;
            color: white;
        }
        
        table > tbody tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        </style>
        <p class="description"></p>
        <div class="overview">
            <table class="library">
                <caption>Basics</caption>
                <tbody>
                </tbody>
            </table>
            <table class="dependencies">
                <caption>Dependencies</caption>
                <tbody>
                </tbody>
            </table>
        </div>
        <slot name="json"></slot>
        `;

        return t;
    }

    /*
    Display an H5P Library JSON block in a table and embedded JSON viewer
     */
    async parseLibrary(library){
        this.addJson(library);
        if(library.description){
            this.description.textContent = library.description;
        }
        let basics = this.shadowRoot.querySelector('.library tbody');
        basics.append(this.newRow('Title', library.title));
        basics.append(this.newRow('Machine Name', library.machineName));
        basics.append(this.newRow('Version', this.getVersionString(library)));
        basics.append(this.newRow('Runnable', library.runnable === 1));
        if(library.author){
            basics.append(this.newRow('Author', library.author));
        }
        if(library.license){
            basics.append(this.newRow('License', library.license));
        }
        if(library.embedTypes){
            basics.append(this.newRow("Embed Types", library.embedTypes.join()));
        }

        let deps = this.shadowRoot.querySelector('.dependencies tbody');
        deps.append(this.newRow("Core API", this.getVersionString(library.coreApi || {})));
        deps.append(this.newRow("Libraries", this.dependencies(library.preloadedDependencies || [])));
        deps.append(this.newRow("Editors", this.dependencies(library.editorDependencies || [])));
    }

    newRow(fieldName, value){
        let tr = document.createElement('tr');
        let tdName = document.createElement('td');
        tdName.textContent = fieldName;
        let tdValue = document.createElement('td');
        if(typeof value === 'object'){
            tdValue.append(value);
        } else {
            tdValue.textContent = value
        }
        tr.append(tdName);
        tr.append(tdValue);
        return tr;
    }

    getVersionString(library){
        if(library.majorVersion){
            return `v${library.majorVersion}.${library.minorVersion}${library.patchVersion ? "." + library.patchVersion : ''}`;
        } else {
            return "None"
        }
    }

    dependencies(deps){
        if(deps.length === 0){
            return "None";
        } else{
            let ul = document.createElement('ul');
            deps.forEach((dep) =>{
                let li = document.createElement('li');
                li.textContent = `${dep.machineName} - ${this.getVersionString(dep)}`;
                ul.append(li);
            })
            return ul
        }
    }

    addJson(library){
        let details = document.createElement('details');
        details.slot = "json";
        let summary = document.createElement('summary');
        summary.textContent = "Library JSON";
        details.append(summary);
        let div = document.createElement('div');
        let pre = document.createElement('pre');
        let code = document.createElement('code')
        code.setAttribute("class", "language-json")
        code.textContent = JSON.stringify(library, undefined, 2)
        pre.append(code);
        div.append(pre);
        details.append(div);

        this.append(details);

        if(typeof hljs !== "undefined"){
            try{hljs.highlightElement(code);} catch {console.log("hljs loaded, but failed to highlight xapi event.")}
        }
    }
}

if( !customElements.get('h5pcli-library-overview')){
    customElements.define('h5pcli-library-overview', H5pcliLibraryOverview);
}
