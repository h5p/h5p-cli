window.addEventListener('load', () => {
  document.getElementById('deleteButton')?.addEventListener('click', async () => {
    try {
      const folder = window.location.href.split('/').pop();
      if (window.confirm(`Are you sure you want to delete "content/${folder}"?`)) {
        console.log(`deleting "content/${folder}"...`);
        const output = await (await fetch(`/remove/${folder}`, {method: 'post'})).json();
        console.log(output.result);
        window.location.href = '/dashboard';
      }
    }
    catch (error) {
      console.log('> error');
      console.log(error);
    }
  });
}); 
