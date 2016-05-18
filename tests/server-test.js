/* Sync server for Loop Habit Tracker
 * Copyright (C) 2016 Álinson Santos Xavier <isoron@gmail.com>
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

process.env.LOOP_ENV = 'test';
var https = require('https');
var config = require('../server/config.js');
https.globalAgent.options.rejectUnauthorized = false;

var should = require('chai').should();
var io = require('socket.io-client');
var serverURL = 'https://[::1]:' + config['serverPort'];

var allEvents = ['connect', 'authOK', 'err', 'execute', 'fetchOK'];

function createClient(callbacks)
{
    var socket = io.connect(serverURL, { secure: true, transports: ['websocket'],
        agent: https.globalAgent });

    allEvents.forEach(function(key) {
        if(callbacks[key]) socket.on(key, data => callbacks[key](socket, data));
    });

    if(!callbacks['err'])
    {
        socket.on('err', function(data) {
            throw data;
        });
    }

    return socket;
}

describe('Server', function()
{
    it('should accept with valid data', function(done)
    {
        createClient({
            'connect': function(socket, data) {
                socket.emit('auth', {'groupKey':'123', 'clientId':'123'});
            },
            'authOK': function(socket, data) {
                socket.disconnect();
                done();
            }
        });
    });

    it('should reject with invalid data', function(done)
    {
        createClient({
            'connect': function(socket, data) {
                socket.emit('auth', '<h1>HELLO WORLD</h1>');
            },
            'err': function(socket, data) {
                data['code'].should.equal(400);
                socket.disconnect();
                done();
            }
        });
    });
});

describe('Live broadcast', function()
{
    it('should reach other clients in the group', function(done)
    {
        var groupKey = '0123456789';

        createClient({
            'connect': function(socket, data) {
                socket.emit('auth', {'groupKey': groupKey, 'clientId': '0'});
            },
            'authOK': function(socket, data) {
                createAnotherClient();
            },
            'execute': function(socket, data) {
                data['command'].should.equal('ToggleRepetition');
                socket.disconnect();
                done();
            }
        });

        function createAnotherClient()
        {
            createClient({
                'connect': function(socket, data) {
                    socket.emit('auth', {'groupKey': groupKey, 'clientId': '1'});
                },
                'authOK': function(socket, data) {
                    socket.emit('post', {'id': 'qwe123', 'command': 'ToggleRepetition', 'data': {
                        'timestamp': 1000000}});
                    socket.disconnect();
                }
            });
        }
    });

    it('should not reach clients outside of the group', function(done)
    {
        var groupKey1 = '0123456789';
        var groupKey2 = '9876543210';

        createClient({
            'connect': function(socket, data) {
                socket.emit('auth', {'groupKey': groupKey1, 'clientId': '0'});
            },
            'authOK': function(socket, data) {
                createAnotherClient();
            },
            'execute': function(socket, data) {
                console.log(data);
                throw 'Should not receive execute event';
            },
        });

        function createAnotherClient()
        {
            createClient({
                'connect': function(socket, data) {
                    socket.emit('auth', {'groupKey': groupKey2, 'clientId': '1'});
                },
                'authOK': function(socket, data) {
                    socket.emit('post', {'id': 'qwe123', 'command': 'ToggleRepetition', 'data': {
                        'timestamp': 1000000}});
                    setTimeout(function() {
                        socket.disconnect();
                        done();
                    }, 250);
                }
            });
        }
    });
});
