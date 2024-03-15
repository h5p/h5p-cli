function dashboard(options) {
  let newContentButton;
  let newContent;
  let importContentButton;
  let importContent;
  let contentTypes;
  let createFolder;
  let importFolder;
  let archive;
  let status;
  let content;
  let pagination;
  let languages;
  let entry;
  let link;
  this.init = () => {
    options.limit = options.limit || 10;
    window.addEventListener('load', () => {
      console.log('> page loaded');
      newContentButton = document.getElementById(options.ids.newContentButton);
      newContent = document.getElementById(options.ids.newContent);
      importContentButton = document.getElementById(options.ids.importContentButton);
      importContent = document.getElementById(options.ids.importContent);
      contentTypes = document.getElementById(options.ids.contentTypes);
      createFolder = document.getElementById(options.ids.createFolder);
      importFolder = document.getElementById(options.ids.importFolder);
      archive = document.getElementById(options.ids.archive);
      status = document.getElementById(options.ids.status);
      content = document.getElementById(options.ids.content);
      pagination = document.getElementById(options.ids.pagination);
      languages = document.getElementById(options.ids.languages);
      entry = content.innerHTML;
      link = pagination.innerHTML;
      option = contentTypes.innerHTML;
      this.getPage();
      this.getContentTypes();
      this.setLanguages();
      if (status.innerText) {
        this.showStatus();
      }
    });
  }
  this.getPage = async (page = 0, limit = options.limit) => {
    try {
      let result = await (await fetch(`${options.api}/projects?page=${page}&limit=${limit}`)).json();
      let contentHTML = '';
      let paginationHTML = '';
      for (let item of result.list) {
        contentHTML += this.fromTemplate(entry, {
          title: item.title,
          library: item.library,
          folder: item.folder,
          icon: item.icon
        });
      }
      const pageCount = Math.ceil(result.total / limit);
      if (pageCount > 1) {
        for (let i = 0; i < pageCount; i++) {
          paginationHTML += this.fromTemplate(link, {
            selected: i == page ? ' selected' : '',
            page: i,
            onclick: `${options.self}.getPage(${i}, ${limit})`
          });
        }
        pagination.innerHTML = paginationHTML;
      }
      else {
        pagination.innerHTML = '';
      }
      content.innerHTML = contentHTML;
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.getContentTypes = async () => {
    try {
      let html = '';
      let result = await (await fetch(`${options.api}/runnable`)).json();
      for (let item in result) {
        html += this.fromTemplate(option, {
          value: item,
          name: item
        });
      }
      contentTypes.innerHTML = html;
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.create = async () => {
    try {
      if (!createFolder.value) {
        throw new Error("enter title");
      }
      this.showStatus('...');
      const type = contentTypes.value;
      const output = await (await fetch(`${options.api}/create/${type}/${encodeURIComponent(createFolder.value)}`, {method: 'post'})).json();
      if (output.result) {
        window.location.href = `/edit/${type}/${output?.result}`;
        return;
      }
      this.toggleNewContent();
      this.getPage();
      this.showStatus(output?.result || output?.error || output);
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.import = async () => {
    try {
      if (!importFolder.value) {
        throw new Error("enter title");
      }
      this.showStatus('...');
      const body = new FormData();
      body.append('file', archive.files[0]);
      const output = await (await fetch(`${options.api}/import/${encodeURIComponent(importFolder.value)}`, { method: 'post', body })).json();
      this.toggleImportContent();
      this.getPage();
      this.showStatus(output?.path ? `imported into "content/${output.path}"` : 0 || output?.error || output);
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.remove = async (project) => {
    try {
      if (window.confirm(`Are you sure you want to delete "content/${project}"?`)) {
        this.showStatus('...');
        const output = await (await fetch(`${options.api}/remove/${project}`, {method: 'post'})).json();
        this.showStatus(output.result);
        this.getPage();
      }
    }
    catch (error) {
      this.handleError(error);
    }
  }
  this.handleError = (error) => {
    this.showStatus(error.toString());
    console.log('> error');
    console.log(error);
  }
  this.toggleNewContent = (ignoreStatus) => {
    if (!ignoreStatus) {
      this.hideStatus();
    }
    newContent.classList.toggle(options.classes.hidden);
    importContent.classList.add(options.classes.hidden);
  }
  this.toggleImportContent = (ignoreStatus) => {
    if (!ignoreStatus) {
      this.hideStatus();
    }
    newContent.classList.add(options.classes.hidden);
    importContent.classList.toggle(options.classes.hidden);
  }
  this.fromTemplate = (template, input) => {
    for (let item in input) {
      template = template.replaceAll(`{${item}}`, input[item]);
    }
    return template;
  }
  this.showStatus = (msg) => {
    status.innerText = msg || status.innerText;
    status.classList.remove(options.classes.hidden);
    newContent.classList.add(options.classes.hidden);
    importContent.classList.add(options.classes.hidden);
  }
  this.hideStatus = () => {
    status.innerText = '';
    status.classList.add(options.classes.hidden);
  }
  this.setLanguages = () => {
    const option = languages.innerHTML;
    let html = '';
    for (let item in options.languages) {
      html += this.fromTemplate(option, {
        value: item,
        name: options.languages[item],
        selected: options.language === item ? ' selected' : ''
      });
    }
    languages.innerHTML = html;
  }
  this.changeLanguage = () => {
    window.location.href = `${options.api}/dashboard?language=${languages.options[languages.selectedIndex].value}`;
  }
}
