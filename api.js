const api = function() {
  this.test = (request, response, next) => {
    console.log(request.body);
    response.json([1, 2, 3, 4, 5]);
  }
}
module.exports = new api(); 
