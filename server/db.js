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

var pg = require('pg');
var config = require('./config.js');
var databaseURL = config['databaseURL'];

function executeQuery(query, params, callback)
{
    if(!callback) throw new Error('callback should not be null');

    pg.connect(databaseURL, function(err, client, done)
    {
        if(err)
        {
            done(client);
            return callback(err, null);
        }

        client.query(query, params, function(err, result)
        {
            done(client);
            if(err) return callback(err, null);
            return callback(null, result);
        });
    });
}

exports.events = {};

exports.events.put = function(timestamp, key, data, callback)
{
    var query = 'insert into events(timestamp, group_key, content) ' +
        'values (to_timestamp($1), $2, $3)';

    executeQuery(query, [timestamp, key, data], function(err)
    {
        if(err) return callback(err);
        callback();
    });
};

exports.events.get = function(key, since, callback)
{
    var query = 'select timestamp, content from events ' +
        'where timestamp >= to_timestamp($1) and group_key = $2';

    executeQuery(query, [since, key], function(err, result)
    {
        if(err) return callback(err, null);
        var timestamps = result.rows.map(row => row.timestamp.getTime() / 1000);
        var contents = result.rows.map(row => JSON.parse(row.content));
        callback(null, { 'contents': contents, 'timestamps': timestamps });
    });
};

exports.snapshots = {};

exports.snapshots.put = function(timestamp, group_key, data, callback)
{
    var query1 = 'delete from snapshots where group_key = $1';
    var query2 = 'insert into snapshots(timestamp, group_key, content) ' +
        'values (to_timestamp($1), $2, $3)';
    var query3 = 'delete from events where timestamp <= to_timestamp($1) and ' +
        'group_key = $2';

    executeQuery(query1, [group_key], function(err)
    {
        if(err) return callback(err);
        executeQuery(query2, [timestamp, group_key, data], function(err)
        {
            if(err) return callback(err);
            executeQuery(query3, [timestamp, group_key], function(err)
            {
                if(err) return callback(err);
                callback(null);
            });
        });
    });
};

exports.snapshots.get = function(key, since, callback)
{
    var query = 'select timestamp, content from snapshots ' +
        'where group_key = $1 and timestamp >= to_timestamp($2) ' +
        'order by timestamp desc limit 1';

    executeQuery(query, [key, since], function(err, result)
    {
        if(err) return callback(err);

        if(result.rows.length > 0)
            callback(null, { 'content': JSON.parse(result.rows[0].content),
                'timestamp': result.rows[0].timestamp });
        else
            callback();
    });
};

exports.register = function(groupKey, callback)
{
    var query = 'insert into group_keys(value) values ($1)';
    executeQuery(query, [groupKey], function(err)
    {
        if(err) return callback(err);
        callback();
    });
};

exports.auth = function(groupKey, callback)
{
    var query = 'select count(*)::int from group_keys where value = $1';
    executeQuery(query, [groupKey], function(err, result)
    {
        if(err) return callback(err);
        callback(null, result.rows[0].count > 0);
    });
};

exports.purge = function(callback)
{
    if(process.env.LOOP_ENV !== 'test')
        throw 'Purge is only available on test environment';

    executeQuery('delete from group_keys', [], function(err)
    {
        if(err) return callback(err);
        executeQuery('delete from events', [], function(err)
        {
            if(err) return callback(err);
            executeQuery('delete from snapshots', [], function(err)
            {
                if(err) return callback(err);
                callback();
            });
        });
    });
};
