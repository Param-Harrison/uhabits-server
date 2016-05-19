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

var colors = require('colors');

exports.inbound = function(key, action, data)
{
    if(!data) data = "";
    console.log(colors.blue("<-- %s %s %s"), key.substring(0, 8), action, JSON.stringify(data));
};

exports.outbound = function(key, action, data)
{
    if(!data) data = "";
    console.log("--> %s %s %s", key.substring(0, 8), action, JSON.stringify(data));
};

exports.event = function(key, msg)
{
    console.log(colors.grey("*** %s %s"), key.substring(0, 8), msg);
};
