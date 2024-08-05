from flask import Flask, render_template, request, send_from_directory, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
import sqlite3

app = Flask(__name__)
app.config['SECRET_KEY'] = 'se Amey valobaseni'
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # Limit to 500 MB
socketio = SocketIO(app)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
connected = 0

@app.route('/')
def index():
    return render_template('index.html')
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/messages/<room>', methods=['GET'])
def get_messages(room):
    conn = sqlite3.connect('messages.db')
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS messages
                      (id INTEGER PRIMARY KEY, room TEXT, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    cursor.execute('SELECT content FROM messages WHERE room = ? AND timestamp > datetime("now", "-12 months")', (room,))
    messages = cursor.fetchall()
    conn.close()
    return jsonify([{'content': msg[0]} for msg in messages])

@socketio.on('connect')
def handle_connect():
    global connected
    connected += 1
    emit('response', {"online": connected},broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    global connected
    connected -= 1
    emit('response', {"online": connected},broadcast=True)

@socketio.on('join')
def handle_join(data):
    room = data['room']
    join_room(room)
    #emit('message', {'msg': f'Joined room: {room}'}, room=room)
    emit('update_messages', {'room': room}, broadcast=False)

@socketio.on('leave')
def handle_leave(data):
    room = data['room']
    leave_room(room)
    emit('message', {'msg': f'Left room: {room}'}, room=room)

@socketio.on('create_private')
def handle_create_private(data):
    room = data['room']
    password = data['password']
    # Store private room data (in a real app, save this info securely)
    emit('message', {'msg': f'Private room created: {room}'}, room=room)

@socketio.on('join_private')
def handle_join_private(data):
    room = data['room']
    password = data['password']
    # Verify password (in a real app, securely verify this)
    join_room(room)
    emit('message', {'msg': f'Joined private room: {room}'}, room=room)
    emit('update_messages', {'room': room}, broadcast=False)

@socketio.on('message')
def handle_message(data):
    room = data['room']
    msg = data['msg']
    conn = sqlite3.connect('messages.db')
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS messages
                      (id INTEGER PRIMARY KEY, room TEXT, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    cursor.execute('INSERT INTO messages (room, content) VALUES (?, ?)', (room, msg))
    conn.commit()
    conn.close()
    emit('message', {'msg': msg}, room=room)

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return 'No file part', 400

    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400

    filename = request.form['filename']
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(file_path)
    
    # Handle the file message in the same way as before
    room = request.form['room']
    if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
        content = f'<img src="{file_path}" class="max-w-full h-auto rounded-lg" />'
    elif filename.lower().endswith(('.mp4', '.webm', '.ogg')):
        content = f'<video src="{file_path}" controls class="max-w-full h-auto rounded-lg" />'
    else:
        content = f'<a href="{file_path}" target="_blank">{filename}</a>'

    # Save the file message in the database
    conn = sqlite3.connect('messages.db')
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS messages
                      (id INTEGER PRIMARY KEY, room TEXT, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    cursor.execute('INSERT INTO messages (room, content) VALUES (?, ?)', (room, content))
    conn.commit()
    conn.close()
    
    socketio.emit('message', {'msg': content}, room=room)
    return 'File uploaded successfully', 200

if __name__ == '__main__':
    socketio.run(app, debug=True, host="0.0.0.0")
