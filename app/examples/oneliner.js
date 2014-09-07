// Mono output
var out = [0];
var x = 0;
var y = 0;

// This function is executed 44100 times per second
function onGetSample (tf) {
  var volume = 0.002;
  var t = Math.floor(tf * 32000);
  var a = (3e3/(y=t&16383)&1)*35+(x=t*"6689"[t>>16&3]/24&127)*y/4e4+((t>>8^t>>10|t>>14|x)&63);
  out[0] = volume * a;
  return out;
}

