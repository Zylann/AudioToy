
var sampleRate = 44100;
var out = [0,0];
var delaybuf = new Array(400);
var delaybuf_i = 1;
var volume = 0.002;
for(var i = 0; i < delaybuf.length; ++i) { delaybuf[i] = 0; }
function onGetSample(t) {
    var s_left = volume*dsp(t);
    var s_right = delaybuf[delaybuf_i];
    delaybuf[delaybuf_i] = s_left;
    ++delaybuf_i;
    if(delaybuf_i == delaybuf.length)
        delaybuf_i = 0;
    out[0] = s_left;
    out[1] = s_right;
    return out;
}

function dsp(t) {
  var ti = Math.floor(t * 8000);
  var _s = cliner(ti);
  return _s;
}

var w=0,k=0,m=0,a=0,d=0,y=0,p=0,h=0,s=0;
function cliner(t) {
    return w=t>>9,k=32,m=2048,a=1-t/m%1,d=(14*t*t^t)%m*a,y=[3,3,4.7,2][p=w/k&3]*t/4,h="IQNNNN!!]]!Q!IW]WQNN??!!W]WQNNN?".charCodeAt(w/2&15|p/3<<4)/33*t-t,s=y*0.98%80+y%80+(w>>7&&a*((5*t%m*a&128)*(0x53232323>>w/4&1)+(d&127)*(0xa444c444>>w/4&1)*1.5+(d*w&1)+(h%k+h*1.99%k+h*0.49%k+h*0.97%k-64)*(4-a-a))),s*s>>14?127:s;
}



