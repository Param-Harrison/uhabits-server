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
var actions = require('./actions.js');
var should = require('chai').should();

var event =
{
    'id': '123',
    'event': 'ToggleRepetition',
    'data': { 'timestamp': 1000000}
};

describe('Live events', function()
{
    it('should reach other clients in the group', function(done)
    {
        var socket1 = actions.connectAndRegister();
        socket1.on('authOK', function()
        {
            connectAnother();
        });

        socket1.on('execute', function(data)
        {
            data.event.should.equal(event.event);
            data.data.timestamp.should.equal(event.data.timestamp);
            socket1.disconnect();
            done();
        });

        function connectAnother()
        {
            var socket2 = actions.connectAndAuth(socket1.groupKey);
            socket2.on('authOK', function()
            {
                socket2.emit('postEvent', event);
                socket2.disconnect();
            });
        }
    });

    it('should not reach clients outside of the group', function(done)
    {
        var socket1 = actions.connectAndRegister();
        socket1.on('authOK', function()
        {
            createAnotherClient();
            setTimeout(function() {
                socket1.disconnect();
                done();
            }, 250); // wait to receive message
        });

        socket1.on('execute', function()
        {
            done(new Error('Should not receive execute event'));
        });

        function createAnotherClient()
        {
            var socket2 = actions.connectAndRegister();
            socket2.on('authOK', function()
            {
                socket2.emit('postEvent', event);
                socket2.disconnect();
            });
        }
    });
});

describe('Delayed events', function()
{
    it('should reach other client as they become online', function(done)
    {
        var since = null;
        var socket1 = actions.connectAndRegister();
        socket1.on('authOK', function()
        {
            socket1.emit('postEvent', event);
        });

        socket1.on('execute', function(data)
        {
            since = data['timestamp'];
            socket1.disconnect();
            createAnotherClient();
        });

        function createAnotherClient()
        {
            var socket2 = actions.connectAndAuth(socket1.groupKey);
            socket2.on('authOK', function ()
            {
                socket2.emit('fetch', {'since': since});
            });

            socket2.on('execute', function(data)
            {
                data.event.should.equal(event.event);
                socket2.disconnect();
                done();
            });
        }
    });
});
