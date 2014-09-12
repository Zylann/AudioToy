"use strict";

// Variable accessible by the user, containing functions and API stuff
var audiotoy = null;

// TODO wrap everything in a closure


function AudioToy() {

	this.apiFunctionNames = [
		"onGetSample", // Called on each sample (44100Hz)
		"onGui", // Called at 60Hz
	];

	this.isPlaying = false;
	this.compiledCode = null;
	this.lastCodeChangeTime = 0;
	this.lastCompilationTime = 0;
	this.compilationDelay = 1000; // Milliseconds before compilation to occur after an edit
	this.t = 0;
	this.sampleRate = 44100;
	this.bufferSize = 4096; // Must be power of two
	this.performanceRatio = 0; // Value between 0 and 1 indicating the CPU usage (1 is the bad limit).
}
AudioToy.prototype = {

	start: function() {

		console.log("start{");

		var self = this;

		// Create code editor
		this.editor = ace.edit("editor");
		this.editor.setTheme("ace/theme/monokai");
		this.editor.getSession().setMode("ace/mode/javascript");
		this.editor.on("change", function(e){
			console.log("Code changed");
			self.lastCodeChangeTime = Date.now();
		});

		// Transport buttons
		this.playButton = document.getElementById("play-button");
		this.playButton.addEventListener("click", function(){
			self.onPlayToggle();
		});

		this.stopButton = document.getElementById("stop-button");
		this.stopButton.addEventListener("click", function() {
			self.stop();
		});

		var githubButton = document.getElementById("github-button");
		githubButton.addEventListener("click", function(){
			// Pause when we go to github
			self.setPlay(false);
		})

		// TODO wire

		this.recordButton = document.getElementById("record-button");
		// TODO wire

		// Create graphic contexts
		this.waveCanvas = document.getElementById("wave-canvas");
		this.waveCanvasContext = this.waveCanvas.getContext("2d");
		this.perfCanvas = document.getElementById("perf-canvas");
		this.perfCanvasContext = this.waveCanvas.getContext("2d");

		audiotoy = new AudioToyAPI(this);

		// Compile base code
		this.compileCode();

		// Create audio context
		this.channelCount = 2;
		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

		/*
		//this.audioBuffer = this.audioContext.createBuffer(this.channelCount, 1*this.sampleRate, this.sampleRate);

		// Get an AudioBufferSourceNode.
		// This is the AudioNode to use when we want to play an AudioBuffer
		this.bufferSource = this.audioContext.createBufferSource();
		// connect the AudioBufferSourceNode to the
		// destination so we can hear the sound
		this.bufferSource.connect(this.audioContext.destination);
		// set the buffer in the AudioBufferSourceNode
		this.bufferSource.buffer = this.audioBuffer;
		*/

		this.bufferSource = this.audioContext.createScriptProcessor(this.bufferSize, 0, this.channelCount); // 0 inputs, 2 outputs
		this.bufferSource.connect(this.audioContext.destination);
		//this.setPlay(true);

		// start the source playing
		//this.bufferSource.loop = true;
		//this.bufferSource.start();

		// Create analyser
		this.analyser = this.audioContext.createAnalyser();
		this.analyser.fftsize = 256;
		this.bufferSource.connect(this.analyser);
		// Initialize audio analysis buffers
		this.amplitudeData = new Uint8Array(this.analyser.frequencyBinCount);
		//this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

		this.mainLoop();

		console.log("}start");
	},

	onAudioProcess: function(e) {
		var timeBefore = Date.now();

		var out = e.outputBuffer;
		var buffers = []
		for(var channel = 0; channel < out.numberOfChannels; ++channel) {
			buffers.push(out.getChannelData(channel));
		}
		this.executeCode(buffers);

		var calcDurationMs = Date.now() - timeBefore;
		var sampleDurationMs = (1000.0 / this.sampleRate);
		this.performanceRatio = (calcDurationMs / this.bufferSize) / sampleDurationMs;
	},

	onAudioProcessDummy: function(e) {
		var out = e.outputBuffer;
		for(var channel = 0; channel < out.numberOfChannels; ++channel) {
			var buffer = out.getChannelData(channel);
			for(var i = 0; i < buffer.length; ++i) {
				buffer[i] = 0;
			}
		}
	},

	compileCode: function() {
		// Header definitions
		var header = "var sampleRate=" + this.sampleRate + ";"; // No newline to not mess with error line numbers

		// Get user code
		var code = this.editor.getValue();
		
		// Append it a return statement containing API functions implementations (defined or not in the code).
		// This is basically an object where is attribute is an implemented API callback or null.
		var memberDefs = [];
		for(var i = 0; i < this.apiFunctionNames.length; ++i) {
			var fname = this.apiFunctionNames[i];
			memberDefs.push(fname + ":(typeof " + fname + "=='function'?" + fname + ":null)");
		}
		var appendix = "\nreturn {" + memberDefs.join(',') + " };";
		code += appendix;

		this.lastCompilationTime = Date.now();

		var pack = null;

		try {
			// Execute the code and get the pack of API functions
			pack = new Function(code)();
		}
		catch(ex) {
			// Something failed when compiling the user's code
			console.log("Compilation failed: " + ex.message + "\n" + ex.stack);
			return false;
		}

		console.log("Compiled");
		this.compiledCode = pack;
		return true;
	},

	executeCode: function(buffers) {
		if(buffers == null || buffers.length == 0) {
			return;
		}
		try{
			// Execute code
			if(this.compiledCode.onGetSample != null) {

				var bufCount = buffers.length;
				var bufLength = buffers[0].length;

				var onGetSample = this.compiledCode.onGetSample;
				var sampleDuration = 1.0 / this.sampleRate;

				// For each sample (all channels)
				for(var i = 0; i < bufLength; ++i) {
					
					// Calculate sample
					var out = onGetSample(this.t);
					
					// For each channel
					for(var c = 0; c < out.length && c < bufCount; ++c) {
						var s = out[c];
						if(s > 1) s = 1;
						if(s < -1) s = -1;
						buffers[c][i] = s;
					}

					this.t += sampleDuration;
				}
			}
			//console.log("Executed");
		}
		catch(ex) {
			console.log("Execution error: " + ex.message + "\n" + ex.stack);
		}
	},

	onPlayToggle: function() {
		this.setPlay(!this.isPlaying);
	},

	setPlay: function(b) {
		this.isPlaying = b;
		var self = this;
		if(this.isPlaying) {
			this.bufferSource.onaudioprocess = function(e) { self.onAudioProcess(e); };
			this.playButton.innerHTML = "<span class=\"fa fa-pause\"></span>"
		}
		else {
			this.bufferSource.onaudioprocess = function(e) { self.onAudioProcessDummy(e); };
			this.playButton.innerHTML = "<span class=\"fa fa-play\"></span>"
		}
		console.log("Playing: " + this.isPlaying);
	},

	stop: function() {
		this.setPlay(false);
		this.t = 0;
	},

	mainLoop: function() {
		var self = this;
		requestAnimationFrame(function() {
			self.mainLoop();
		});

		if(Date.now() - this.lastCodeChangeTime > this.compilationDelay && this.lastCodeChangeTime > this.lastCompilationTime) {
			this.compileCode();
			//this.executeCode();
		}

		if(this.compiledCode.onGui) {
			this.compiledCode.onGui();
		}

		//var playOffset = this.bufferSource.

		this.analyser.getByteTimeDomainData(this.amplitudeData);
		this.renderWave();
		this.renderPerf();
	},

	renderPerf: function() {
		var g = this.perfCanvasContext;
		var canvas = this.perfCanvas;

		// Clear
		g.fillStyle = "#191916"; //"#171814";
		g.fillRect(0, 0, canvas.width, canvas.height);

		// Draw
		var h = this.performanceRatio * canvas.height;
		g.fillStyle = "#f00";
		g.fillRect(0, canvas.height-1-h, canvas.width, h);
	},

	renderWave: function() {
		var g = this.waveCanvasContext;
		var canvas = this.waveCanvas;

		// Clear
		g.fillStyle = "#191916";//"#171814";
		g.fillRect(0, 0, canvas.width, canvas.height);

		// Draw

		g.strokeStyle = "#fa4";
		g.beginPath();

		var sliceWidth = canvas.width / this.amplitudeData.length;
		var x = 0;

		for(var i = 0; i < this.amplitudeData.length; i++) {

			var a = this.amplitudeData[i] / 128.0 - 1.0;

			var y = 1.5*a;

			y = 0.5 * (-y) + 1;
			y = y * canvas.height/2;
			if(i === 0) {
				g.moveTo(x, y);
			} else {
				g.lineTo(x, y);
			}

			x += sliceWidth;
		}

		g.lineWidth = 1;
		//g.lineTo(canvas.width, canvas.height/2);
		g.stroke();
	},

};


function AudioToyGUI() {
}
AudioToyGUI.prototype = {

};


function AudioToyAPI(a) {
	var _core = a;

	this.sampleRate = function() {
		return _core.sampleRate;
	}
};


