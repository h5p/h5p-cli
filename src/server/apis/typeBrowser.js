const fs = require('fs');
const path = require('path');
const logic = require('../../../logic.js');
const config = require('../../../configLoader.js');
const userSession = require('../user_session.js');

const xapiExamplesDir = "events/xapi/examples";
// Default data links to locate
const linksData = {semantics: "semantics.json", };

/**
 * Render the /type_browser/index.html page with translations
 *
 * @route   GET /type_browser
 */
async function typeBrowserIndex(request, response, next) {
    try {
        userSession.updateFromQuery(request);
        const html = fs.readFileSync(`${require.main.path}/${config.folders.assets}/type_browser/index.html`, 'utf-8');
        const labels = await userSession.getLangLabels();
        response.set('Content-Type', 'text/html');
        response.end(logic.fromTemplate(html, labels));
    } catch (error) {
        handleError(error, response);
    }
}

/**
 *  Return list of Augmented H5P Library objects that include links
 *
 * @route   GET /type_browser/installed_libraries
 */
async function installedLibraries(request, response, next) {
    try {
        const out = await fullLibraries();

        response.set('Content-Type', 'application/json');
        response.end(JSON.stringify(out));
    } catch (error) {
        handleError(error, response);
    }
}

/**
 * Renders a content page for displaying details about a Library
 *
 * @route GET /type_browser/:library
 * @param request.library
 */
async function contentType(request, response, next) {
    try {
        userSession.updateFromQuery(request);
        const html = fs.readFileSync(`${require.main.path}/${config.folders.assets}/type_browser/content_type.html`, 'utf-8');
        const labels = await userSession.getLangLabels();
        response.set('Content-Type', 'text/html');
        response.end(logic.fromTemplate(html, labels));
    } catch (error) {
        handleError(error, response);
    }
}

/**
 * Returns the Augmented Library JSON object for the specified :library
 *
 * @route /type_browser/:library/library.json
 * @param request.library
 */
async function contentTypeLibrary(request, response, next){
    const out = await singleLibrary(request.params.library);

    response.set('Content-Type', 'application/json');
    response.end(JSON.stringify(out));
}

/**
 * If the specified :library has example xAPI events in events/xapi/examples return them in a JSON array
 *
 * @route /type_browser/:library/xapi_examples
 * @param request.library
 */
async function xapiEventsForType(request, response, next){
    const out = {xapiExamples: []};

    let xapiDir = path.join(config.folders.libraries, request.params.library, xapiExamplesDir)
    if(fs.existsSync(xapiDir)){
        const files = fs.readdirSync(xapiDir);
        const jsonFiles = files.filter(el => path.extname(el) === '.json')
        for (let file of jsonFiles) {
            out['xapiExamples'].push(await logic.getFile(path.join(xapiDir, file), true));
        }
    }

    response.set('Content-Type', 'application/json');
    response.end(JSON.stringify(out));
}

module.exports = {contentType, contentTypeLibrary, installedLibraries, typeBrowserIndex, xapiEventsForType}


/*
Helper functions
 */

/**
 * Using the registry list, iterate all local libraries and generate a list of Augmented Library JSON
 */
async function fullLibraries()  {
    let registry = await logic.getRegistry();
    registry = registry.regular;
    const output = {};
    const dirs = fs.readdirSync(config.folders.libraries);
    for (let folder of dirs) {
        let lib = await fullLibrary(folder, registry);
        if(lib) output[lib.library.machineName] = lib;
    }
    return output;
}

/**
 * Generate an Augmented Library JSON for the specified Library
 * @param libraryFolder
 * @returns {Promise<undefined|{links_data: {library: string}, icon_url: null, links_web: {docPage: string}, library: null}>}
 */
async function singleLibrary(libraryFolder){
    let registry = await logic.getRegistry();
    registry = registry.regular;

    return await fullLibrary(libraryFolder, registry);
}

/**
 * Generate an Augmented Library JSON for the specified Library
 * @param folderName
 * @param registry
 * @returns {Promise<{links_data: {library: string}, icon_url: null, links_web: {docPage: string}, library: null}>}
 */
async function fullLibrary(folderName, registry) {
    let folder = path.join(config.folders.libraries, folderName);
    const libraryFile = path.join(folder, "library.json");
    if (!fs.existsSync(libraryFile)) {
        return;
    }

    let out = {
        links_data: {library: path.join("/", libraryFile)},
        links_web: {docPage: `/type_browser/${folderName}/`},
        icon_url: null,
        library: null,
    }

    out.library = await logic.getFile(libraryFile, true);

    const id = out.library.machineName;
    if (registry[id]) {
        out.library["repoName"] = registry[id]["repoName"];
        out.library["org"] = registry[id]["org"];
        out.library["shortName"] = registry[id]["shortName"];
    }

    let iconPath = path.join(folder, "icon.svg")
    if (fs.existsSync(iconPath)) out.icon_url = path.join("/", iconPath);

    let xapiPath = path.join(folder, xapiExamplesDir)
    if(fs.existsSync(xapiPath)){
        out.links_data['xapi_examples'] = `/type_browser/${folderName}/xapi_examples`;
    }

    for (const [key, file] of Object.entries(linksData)) {
        const localPath = path.join(folder, file);
        if (fs.existsSync(localPath)) out.links_data[key] = path.join("/", localPath);
    }

    return out;
}


// Helpers copied from ../api.js, find way to reuse?
const handleError = (error, response) => {
    console.log(error);
    response.set('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: error.toString() }));
}
