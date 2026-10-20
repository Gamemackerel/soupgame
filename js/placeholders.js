// The art branch draws every character as a plain placeholder sketch (see js/sprites.js); main draws the real
// placeholder art. This is the only difference, and the only line that differs between the branches here.
// (#sketches in the URL turns them on here too, for the artist's scene preview, art/preview.html.)
var PLACEHOLDER_SKETCHES = /(^#|&)sketches(&|$)/.test(location.hash);
