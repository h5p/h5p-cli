function dashboard(options) {
  let content;
  let pagination;
  let entry;
  let link;
  let limit;
  this.init = () => {
    window.addEventListener('load', (event) => {
      try {
        console.log('> page loaded');
        content = document.getElementById(options.ids.content);
        pagination = document.getElementById(options.ids.pagination);
        entry = content.innerHTML;
        link = pagination.innerHTML;
        limit = options.limit || 10;
        this.getPage(0, limit);
      }
      catch (error) {
        console.log('> error');
        console.log(error);
      }
    });
  }
  this.getPage = async (page, limit) => {
    let result = await (await fetch(`${options.host}/projects?page=${page}&limit=${limit}`)).json();
    let contentHTML = '';
    let paginationHTML = '';
    for (let item of result.list) {
      contentHTML += this.fromTemplate(entry, {
        name: item.name,
        library: item.library,
        folder: item.folder
      });
    }
    const pageCount = Math.ceil(result.total / limit);
    for (let i = 0; i < pageCount; i++) {
      paginationHTML += this.fromTemplate(link, {
        selected: i == page ? ' selected' : '',
        page: i,
        onclick: `${options.self}.getPage(${i}, ${limit})`
      });
    }
    content.innerHTML = contentHTML;
    pagination.innerHTML = paginationHTML;
  }
  this.fromTemplate = (template, input) => {
    for (let item in input) {
      template = template.replaceAll(`{${item}}`, input[item]);
    }
    return template;
  }
}
