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
      entry = content.innerHTML;
      link = pagination.innerHTML;
      option = contentTypes.innerHTML;
      this.getPage();
      this.getContentTypes();
      status.addEventListener('click', () => {
        status.innerText = '';
      });
    });
  }
  this.getPage = async (page = 0, limit = options.limit) => {
    try {
      let result = await (await fetch(`${options.host}/projects?page=${page}&limit=${limit}`)).json();
      let contentHTML = '';
      let paginationHTML = '';
      for (let item of result.list) {
        contentHTML += this.fromTemplate(entry, {
          title: item.title,
          library: item.library,
          folder: item.folder
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
      console.log('> error');
      console.log(error);
    }
  }
  this.getContentTypes = async () => {
    try {
      let html = '';
      let result = await (await fetch(`${options.host}/runnable`)).json();
      for (let item in result) {
        html += this.fromTemplate(option, {
          value: item,
          name: item
        });
      }
      contentTypes.innerHTML = html;
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  }
  this.create = async () => {
    try {
      status.innerText = '...';
      const type = contentTypes.value;
      const output = await (await fetch(`${options.host}/create/${type}/${createFolder.value}`, {method: 'post'})).json();
      if (output.result) {
        window.location.href = `/edit/${type}/${createFolder.value}`;
        return;
      }
      this.toggleNewContent();
      this.getPage();
      status.innerText = output?.result || output?.error || output;
    }
    catch (error) {
      status.innerText = 'error :(';
      console.log('> error');
      console.log(error);
    }
  }
  this.import = async () => {
    try {
      status.innerText = '...';
      const body = new FormData();
      body.append('file', archive.files[0]);
      const output = await (await fetch(`${options.host}/import/${importFolder.value}`, { method: 'post', body })).json();
      this.toggleImportContent();
      this.getPage();
      status.innerText = output?.path ? `imported into "content/${output.path}"` : 0 || output?.error || output;
    }
    catch (error) {
      status.innerText = 'error :(';
      console.log('> error');
      console.log(error);
    }
  }
  this.remove = async (project) => {
    try {
      if (window.confirm(`Are you sure you want to delete the "content/${project}" project?`)) {
        status.innerText = '...';
        const output = await (await fetch(`${options.host}/remove/${project}`, {method: 'post'})).json();
        status.innerText = output.result;
        this.getPage();
      }
    }
    catch (error) {
      status.innerText = 'error :(';
      console.log('> error');
      console.log(error);
    }
  }
  this.toggleNewContent = () => {
    status.innerText = '';
    newContent.classList.toggle(options.classes.hidden);
    importContentButton.classList.toggle(options.classes.hidden);
    newContentButton.innerText = newContentButton.innerText == options.labels.new ? options.labels.close : options.labels.new;
  }
  this.toggleImportContent = () => {
    status.innerText = '';
    importContent.classList.toggle(options.classes.hidden);
    newContentButton.classList.toggle(options.classes.hidden);
    importContentButton.innerText = importContentButton.innerText == options.labels.import ? options.labels.close : options.labels.import;
  }
  this.fromTemplate = (template, input) => {
    for (let item in input) {
      template = template.replaceAll(`{${item}}`, input[item]);
    }
    return template;
  }
}
