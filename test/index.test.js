const jsdom = require("jsdom");
const { JSDOM } = jsdom;

var dom= new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');

global.window = dom.window;
global.document = global.window.document;





describe("Integration Test", function() {
  it("should fail if gameframe wasn't imported correctly", function () {
  	const GameFrame = require('../src/js/gameFrame.js');
  })
})