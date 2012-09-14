//CLIENT
// Fallbacks for vendor-specific variables until the spec is finalized.
var PeerConnection = window.PeerConnection || window.webkitPeerConnection00 || window.mozPeerConnection;
var URL = window.URL || window.webkitURL || window.msURL || window.oURL;


// Holds the STUN server to use for PeerConnections.
var SERVER = "STUN stun.l.google.com:19302";

// Reference to the lone PeerConnection instance.
var peerConnections = {};


/**
 * Connects to the websocket server.
 */
function signalling_channel(server)
{
  // Holds a connection to the server.
  var socket = new WebSocket(server);

  socket.onopen = function()
  {
    socket.onmessage = function(msg)
    {
      console.log("RECEIVED: "+msg.data);

      var json = JSON.parse(msg.data);

      switch(json.eventName)
      {
        case 'get_peers':
          var connections = json.data.connections;

          for(var i = 0; i < connections.length; i++)
          {
            // Create PeerConnection
            var pc = createPeerConnection(connections[i]);

            // Send offer to new PeerConnection

			// TODO: Abstract away video: true, audio: true for offers
			var offer = pc.createOffer({
			  video: true,
			  audio: true
			});

			socket.send(JSON.stringify(
			{
			  "eventName": "send_offer",
			  "data":
			  {
			    "socketId": connections[i],
			    "sdp": offer.toSdp()
			  }
			}), function(error)
			{
			  if(error)
			    console.log(error);
			});

            pc.setLocalDescription(pc.SDP_OFFER, offer);

            pc.startIce();
          }
        break

        case 'new_peer_connected':
          createPeerConnection(json.data.socketId);
        break

        case 'remove_peer_connected':
          delete peerConnections[json.data.socketId];
        break

        case 'receive_offer':
        {
          var pc = peerConnections[json.data.socketId];
          pc.setRemoteDescription(pc.SDP_OFFER, new SessionDescription(json.data.sdp));

          // Send answer
          var offer = pc.remoteDescription;

          // TODO: Abstract away video: true, audio: true for answers
          var answer = pc.createAnswer(offer.toSdp(),
          {
            video: true,
            audio: true
          });

          pc.setLocalDescription(pc.SDP_ANSWER, answer);
          socket.send(JSON.stringify(
          {
            "eventName": "send_answer",
            "data":
            {
              "socketId": json.data.socketId,
              "sdp": answer.toSdp()
            }
          }), function(error)
          {
            if(error)
              console.log(error);
          });

          pc.startIce();
        }
        break

        case 'receive_answer':
        {
          var pc = peerConnections[json.data.socketId];
          pc.setRemoteDescription(pc.SDP_ANSWER, new SessionDescription(json.data.sdp));
        }
      }
    };

    socket.onerror = function(err)
    {
      console.log('onerror: '+err);
    };
  };


  function createPeerConnection(id)
  {
    console.log('createPeerConnection');

    var pc = new PeerConnection(SERVER, function(candidate, moreToFollow){});

    pc.onopen = function()
    {
      var channel = pc.createDataChannel('chat')
          channel.onmessage = function(message)
          {
            var data = JSON.parse(message.data)

            addToChat(data.messages, data.color.toString(16));
          }
    };

    peerConnections[id] = pc

    return pc;
  }
};