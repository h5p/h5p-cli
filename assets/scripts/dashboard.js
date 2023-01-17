function dashboard(options) {
  let newContentButton;
  let newContent;
  let contentTypes;
  let folder;
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
      contentTypes = document.getElementById(options.ids.contentTypes);
      folder = document.getElementById(options.ids.folder);
      status = document.getElementById(options.ids.status);
      content = document.getElementById(options.ids.content);
      pagination = document.getElementById(options.ids.pagination);
      entry = content.innerHTML;
      link = pagination.innerHTML;
      option = contentTypes.innerHTML;
      this.getPage();
      this.getContentTypes();
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
  this.createContent = async () => {
    try {
      status.innerText = '...';
      const type = contentTypes.value;
      const output = await (await fetch(`${options.host}/create/${type}/${folder.value}`, {method: 'post'})).json();
      this.toggleNewContent();
      this.getPage();
      status.innerText = output.result;
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
    newContentButton.innerText = newContentButton.innerText == options.labels.newContent ? options.labels.close : options.labels.newContent;
  }
  this.fromTemplate = (template, input) => {
    for (let item in input) {
      template = template.replaceAll(`{${item}}`, input[item]);
    }
    return template;
  }
}