$(document).ready(function() {
    const socket = io();
    const publicRoom = 'public'; // Public room name
    let currentRoom = publicRoom;
    const messagesContainer = $('#messages-container');
    const uploadProgress = $('#uploadProgress'); // For showing file upload progress
    const bar = $("#load");

    function scrollToBottom() {
        messagesContainer.scrollTop(messagesContainer.prop('scrollHeight'));
    }

    function adjustHeight() {
        const $textarea = $('#messageinput');
        $textarea.css('height', 'auto');
        $textarea.css('height', $textarea.prop('scrollHeight') + 'px');
    }

    $('#messageinput').on('input', adjustHeight);

    $('#send_message').on('click', function() {
        const message = $('#messageinput').val();
        if (message.trim() !== '') {
            socket.emit('message', { room: currentRoom, msg: message });
            $('#messageinput').val('');
        }
    });

    $('#sendFile').click(function() {
        $('#fileInput').click();
    });

    $('#fileInput').change(function() {
        const fileInput = $('#fileInput')[0];
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileName = file.name;

            // Create a FormData object to send the file with progress
            const formData = new FormData();
            formData.append('file', file);
            formData.append('filename', fileName);
            formData.append('room', currentRoom);

            // Create XMLHttpRequest to upload the file
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/upload', true);

            xhr.upload.onprogress = function(event) {
                if (event.lengthComputable) {
                    const percentLoaded = Math.round((event.loaded / event.total) * 100);
                    uploadProgress.show();
                    bar.show()
                    bar.attr("value",percentLoaded)
                    uploadProgress.text(`${percentLoaded}%`);
                }
            };

            xhr.onload = function() {
                if (xhr.status === 200) {
                    uploadProgress.text('Upload complete.');
                    bar.hide()
                    setTimeout(() => uploadProgress.hide(), 2000); // Hide after a short delay
                } else {
                    uploadProgress.text('Upload failed.');
                    setTimeout(() => uploadProgress.hide(), 2000); // Hide after a short delay
                }
            };

            xhr.onerror = function() {
            	bar.hide()
                uploadProgress.text('Upload error.');
                setTimeout(() => uploadProgress.hide(), 2000); // Hide after a short delay
            };

            xhr.send(formData);
            scrollToBottom();
        }
    });

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    socket.emit('join', { room: publicRoom });

    function updateButtonVisibility() {
        if (currentRoom === publicRoom) {
            $('#leave').addClass('hidden');
            $('#create_or_join_room').removeClass('hidden');
        } else {
            $('#create_or_join_room').addClass('hidden');
            $('#leave').removeClass('hidden');
        }
    }

    $('#createPrivate').click(function() {
        const room = prompt('Enter private room name:');
        const password = prompt('Enter password:');
        if (room && password) {
        	if (currentRoom === publicRoom) {
        		socket.emit('leave', { room: currentRoom });
        	}
            socket.emit('create_private', { room: room, password: password });
            currentRoom = room;
            socket.emit('join_private', { room: room, password: password });
            $('#currentRoom').text(`Private Room: ${room}`);
            updateButtonVisibility();
        }
    });

    $('#joinPrivate').click(function() {
        const room = prompt('Enter private room name:');
        const password = prompt('Enter password:');
        if (room && password) {
            socket.emit('join_private', { room: room, password: password });
            currentRoom = room;
            $('#currentRoom').text(`Private Room: ${room}`);
            updateButtonVisibility();
        }
    });

    $('#leaveRoom').click(function() {
        socket.emit('leave', { room: currentRoom });
        currentRoom = publicRoom;
        $('#currentRoom').text('Public Chat Room');
        updateButtonVisibility();
        socket.emit('join', { room: publicRoom });
    });

    socket.on('message', function(data) {
        const content = `<div class="message-content">${data.msg}</div>`;
        $('#messages').append(`<li class="bg-gray-700 p-3 rounded-lg shadow-md text-sm md:text-base">${content}</li>`);
        scrollToBottom();
    });
    
    
    socket.on("response", function(data){
    	$("#messageinput").attr("placeholder",`message.... [total online user ${ data.online}]`)
    });

    socket.on('update_messages', function(data) {
        $('#messages').empty(); // Clear messages
        $.get(`/messages/${data.room}`, function(messages) {
            messages.forEach(msg => {
                $('#messages').append(`<li class="bg-gray-700 p-3 rounded-lg shadow-md text-sm md:text-base message-content">${msg.content}</li>`);
            });
            scrollToBottom();
        });
    });
    updateButtonVisibility();
});
