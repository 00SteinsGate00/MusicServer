import fs from 'fs';
import downloader from 'youtube-dl';
import sanitize from 'sanitize-filename';
import fsw from 'file-size-watcher';
import Future from 'fibers/future'


Meteor.methods({
    // enqueues a song to the playlist
   'enqueue': function(url){

      // make this method unblocking
      this.unblock();

      // future to wait for the asynchronous stuff to finish
      var future = new Future();

      downloader.getInfo(url, Meteor.bindEnvironment(function(error, info){

       // check wether youtube-dl was able to handle the url
        if(!info){
          console.log(error);
          future.throw(new Meteor.Error('url_invalid', 'url was not valid'));
        }
        // everything went fine
        else{
          // number of titles in the playlist
          var playlistLength = Playlist.find().count();

          // get the thumbnail
          var thumbnail = Thumbnails.insert(info.thumbnails[0].url);

           // create the entry attributes
          var playlistEntry = {
                   title: info.title,
                   url: url,
                   duration: timeStringToSeconds(info.duration),
                   position: playlistLength,
                   thumbnail: thumbnail
          };

          // insert the song
          Playlist.insert(playlistEntry, function(error, id){
                if(!error){
                    // if cached download the song
                    if(Options.findOne().download){
                      // default arguments youtube-dl
                      var args = ['--format=251/171/140/250/249/bestaudio'];

                      // get the song
                      var song = downloader(url, args);

                      // strip the filename from characters reserved by the filesystem
                      var filename = `${sanitize(info.title, " ")}.mp3`;

                      // save the song to HDD
                      song.pipe(fs.createWriteStream(`songs/${filename}`));

                      Playlist.update({_id: id}, {$set: {'file': `songs/${filename}`}});
                    }

                    // playlistLength is the length BEFORE inserting the new song
                    // if this is the only song in the playlist, start it
                    if(playlistLength == 0){
                      if(Options.findOne().download){
                        // check for the filesize because when 'play' is called the early, the filesize is so small
                        // playback stops immediatly
                        var fileWatcher = fsw.watch(`songs/${filename}`).on('sizeChange', Meteor.bindEnvironment(function (newSize, oldSize){
                          // when the file is bigger than 200kB play it
                          if(newSize > 500000){
                            Meteor.call('play');
                            // release the file watcher
                            fileWatcher.stop();
                          }
                        }));
                      }
                      // uncached case is just streaming anyway
                      else{
                        Meteor.call('play');
                      }
                    }

                    future.return(true);
                }
                else{
                    console.log("Error in enqueue: " + error.message);
                    future.return(false);
                }

          });

        }

      }));

      return future.wait();

   },
    // deletes an entry in the playlist
    'delete': function(pos){
        // it is not possible to delete the currently playing song
        if(pos == 0){
            return false;
        }
        // pos >= 1
        else {
            var deleteCandidate = Playlist.findOne({'position': pos});

            // if the position is avaiable
            if (deleteCandidate) {
                // delete associated file
                if(deleteCandidate.file && fs.existsSync(deleteCandidate.file)) {
                    fs.unlinkSync(deleteCandidate.file);
                }

                // delete the Thumbail
                Thumbnails.remove(deleteCandidate.thumbnail._id);

                // remove the entry from the playlist
                Playlist.remove(deleteCandidate._id);

                // adjust playist positions
                Playlist.update({
                    'position': {$gte: pos}
                },
                {
                    $inc: {'position': -1}
                },
                {
                    'multi': true
                });

                return true;
            } else {
                return false;
            }
        }
    },
    // clears the whole playlist
    clear: function() {
        Playlist.find().fetch().forEach(function (title) {
            if(title.file){
                fs.unlinkSync(title.file);
            }
            Playlist.remove(title._id);
        });
    }
});
