import noUiSlider from'nouislider';

Template.controlpanel.helpers({
	currentSong: function () {
		return Playlist.findOne({'position': 0});
	},
	playingStatus: function() {
		return Status.findOne().playing;
	},
	// is always called in the context of a playlist entry
	durationDisplay: function() {
		// return the formatted time string
		return timeFormat(this.duration, this.duration);
	},
	currentPosition: function() {
		// the current position
		var time = Template.instance().clientTimePos.get();
		// whole duration of the song
		var duration = this.duration;

		// return the formatted time string
		return timeFormat(time, duration);
	},
	getThumbnail: function() {
		var currentSong = Playlist.findOne({'position': 0});
		if(Template.instance().subscriptionsReady()){
			var thumbnail = this.thumbnail.getFileRecord();
			// console.log(thumbnail.url());
			return thumbnail.url({'store': 'Thumbnail'});
		}
	},
	// on song change this function sets the range of the slider
	adjustSlider: function() {
		var currentSong = Playlist.findOne({'position': 0});

		if(Template.instance().slider && currentSong){
			Template.instance().slider.noUiSlider.updateOptions({
				range: {
					'min': 0,
					'max': currentSong.duration
				}
			});
		}
	}
});


Template.controlpanel.events({
	'click #playpause': function () {
		// if playing toggle pause
		Meteor.call('pause');		
	},
	'click #skip': function() {
		Meteor.call('skip');
	},
	'click #mute': function() {
		Meteor.call('mute');
	}
});



Template.controlpanel.onCreated(function() {

	this.subscribe('currentSong');

	// subscribe to the publications
	this.subscribe('currentSong');
	this.subscribe('status');

	// define client time position as a reactive var
	this.clientTimePos = new ReactiveVar(0);

	// keeps track of wether a song is playing or not
	this.playingStatus;

	// keeps track of wether the slider is moved at the moment
	this.sliding = false;

	// this will update the time position server side
	// resulting in a hotpush to every client
	Meteor.call('getTimePos');

	// this updates the states whenever they are changed on the serverside
	this.autorun(function() {
		var status = Status.findOne();
		// var currentSong = Playlist.findOne({'position': 0});
		if(status){
			// clear the timer to prevent races
			clearInterval(this.intervalTimer);
			// update the client status vars
			this.clientTimePos.set(status.currentPosition);
			this.playingStatus  = status.playing;
			// reset the timer to prevent syncronisation bugs
			this.intervalTimer = setInterval(this.updateTimer, 1000);
			// set the volumeSlider
			if(this.volumeSlider && status.volume){
				this.volumeSlider.noUiSlider.set(status.volume);
			}
		}
	}.bind(this));

	// When there is no song in the queue and the first one is enqueued
	// the getTemplate helper does not work for some reason
	this.autorun(function() {
		if(this.subscriptionsReady()){
			var currentSong = Playlist.findOne({'position': 0});
			if(currentSong && (Playlist.find().count() == 1)){
				var thumbnail = currentSong.thumbnail.getFileRecord();
				$('#thumbnail').attr('src', thumbnail.url());
			}
		}
	}.bind(this));

	// the interval function
	// this function updates the client time position roughly every second
	this.updateTimer = function( ){
		if(this.playingStatus){
			// update the slider position if the user isn't dragging it at the moment
			if(this.slider && !this.sliding){
				// increase the timer
				this.clientTimePos.set(this.clientTimePos.get() + 1);
				this.slider.noUiSlider.set(this.clientTimePos.get());
			}
		};
	}.bind(this)
	
	// the interval timer updates the time roughly every second
	this.intervalTimer = setInterval(this.updateTimer, 1000);

	// the UI slider
	this.slider;

	// the slider for the volume
	this.volumeSlider;
	

});

Template.controlpanel.onRendered(function() {
	console.log("rendered");
});