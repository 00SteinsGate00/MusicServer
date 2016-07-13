import downloader from 'youtube-dl';
import mpv from 'node-mpv';
import fs  from 'fs';
import sanitize from 'sanitize-filename'


// global variable to access mpv
mpv_player = null;

// state weather songs should be cached or not
cached = true;

// saves the mpv status properties
player_status = {};

// saves the current time position of the playing song
timeposition = 0;
setTime = false;

// to save the volume value when muted
volume_before_mute = 0;


Meteor.startup(function() {

    // start mpv player in audio only mode
    mpv_player = new mpv({
        audio_only: true,
        time_update: 0.5
    });

    // set up the events
    mpv_player.on('started', Meteor.bindEnvironment(mpv_started));
    mpv_player.on('stopped', Meteor.bindEnvironment(mpv_stopped));
    mpv_player.on('paused', Meteor.bindEnvironment(mpv_paused));
    mpv_player.on('resumed', Meteor.bindEnvironment(mpv_resumed));
    mpv_player.on('statuschange', Meteor.bindEnvironment(mpv_statuschange));
    mpv_player.on('timeposition', Meteor.bindEnvironment(mpv_timeposition));

    // create the folder to store the cached songs
    if(!fs.existsSync('songs')){
        fs.mkdirSync('songs');
    }

    // create the status database object, if not already created
    if(Status.find().count() == 0){
        Status.insert({
            currentPosition: 0,
            playing: false,
            volume: 50
        });
    }
    else{
        Status.update({}, {$set: {currentPosition: 0, playing: false}});
    }

    // set the volume
    mpv_player.volume(Status.findOne().volume);
    volume_before_mute = Status.findOne().volume;

    // download every song if cached mode is activated
    if (cached) {
        // arguments to select the format for youtube-dl
        var args = ['--format=251/171/140/250/249/bestaudio'];

        // download each song in the playlist
        Playlist.find().forEach(function (queuedSong) {
            // download the song
            var song = downloader(queuedSong.url, args);

            // write it to the HDD
            song.pipe(fs.createWriteStream(`songs/${sanitize(queuedSong.title, " ")}.mp3`));

            console.log(`Handling title "${queuedSong.title}"`);
        });
    }

    // syncs the client time with the real time roughly every 20 seconds
    setInterval(Meteor.bindEnvironment(function(){
        Status.update({}, {$set: {'currentPosition': timeposition}});
    }), 20000);

    // if there are songs in the queue, play them
    if(Playlist.find().count() > 0){
        // TODO find something better for the timeout
        setTimeout(Meteor.bindEnvironment(function(){
            Meteor.call('play');
        }), 3000);
    }

});