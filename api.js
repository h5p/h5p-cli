module.exports = {
  test: (request, response, next) => {
    console.log(request.body);
    response.json([1, 2, 3, 4, 5]);
  }
}
