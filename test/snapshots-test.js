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

var event1 =
{
    'id': 'ev001',
    'event': 'ToggleRepetition',
    'data': { 'timestamp' : 1000000 }
};

var event2 =
{
    'id': 'ev002',
    'event': 'ToggleRepetition',
    'data': { 'timestamp' : 2000000 }
};

var snapshot =
{
    'id': 'snap001',
    'data': { 'habits': [1, 2, 3] }
};

describe('Snapshots', function()
{
    it('should be posted and retrieved', function(done)
    {
        var socket = actions.connectAndRegister();

        socket.on('authOK', function()
        {
            socket.emit('postSnapshot', snapshot)
            socket.disconnect();
            done();
        })
    });

    it('should replace previous events', function(done)
    {
        var socket = actions.connectAndRegister();
        var snapshotPosted = false;
        var fetchPosted = false;
        var fetchedIds = [];

        socket.on('authOK', function()
        {
            socket.emit('postEvent', event1);
        });

        socket.on('execute', function(data)
        {
            if(!snapshotPosted)
            {
                data.id.should.equal(event1.id);
                snapshotPosted = true;
                socket.emit('postSnapshot', snapshot);
            }
            else if(!fetchPosted)
            {
                data.id.should.equal(event2.id);
                fetchPosted = true;
                socket.emit('fetch', {'since': 0});
            }
            else
                fetchedIds.push(data.id);
        });

        socket.on('replace', function (data)
        {
            if(!fetchPosted)
            {
                data.id.should.equal(snapshot.id);
                socket.emit('postEvent', event2);
            }
            else
                fetchedIds.push(data.id);
        });

        socket.on('fetchOK', function()
        {
            fetchedIds[0].should.equal(snapshot.id);
            fetchedIds[1].should.equal(event2.id);
            socket.disconnect();
            done();
        })
    });

});