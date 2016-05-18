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

function executeQuery(query, params)
{
    executeQuery(query, params, null);
}

function executeQuery(query, params, callback)
{
    pg.connect(databaseURL, function(err, client, done)
    {
        if(err)
        {
            console.log(err);
            if(callback) callback(err, null);
            done(client);
            return;
        }

        client.query(query, params, function(err, result)
        {
            done(client);

            if(err)
            {
                console.log(err);
                if(callback) callback(err, null);
                return;
            }

            if(callback) callback(null, result);
        });
    });
}

exports.put = function(timestamp, key, data)
{
    var query = 'insert into commands(timestamp, group_key, content) ' +
        'values (to_timestamp($1), $2, $3)';

    executeQuery(query, [timestamp, key, data]);
}

exports.get = function(key, since, callback)
{
    var query = 'select timestamp, content from commands ' +
        'where timestamp > to_timestamp($1) and group_key = $2';

    executeQuery(query, [since, key], function(err, result)
    {
        if(err) return;

        var timestamps = result.rows.map(
            row => row.timestamp.getTime() / 1000
        );

        var contents = result.rows.map(
            row => JSON.stringify(row.content)
        );

        callback(contents, timestamps);
    });
}
