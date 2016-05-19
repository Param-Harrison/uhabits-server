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

var config =
{
    'production': {
        'serverHostname': '::',
        'serverPort': 4000,
        'databaseURL': 'postgres://localhost/habits_prod',
        'sslKeyFile': '/home/isoron/SSL/sync.loophabits.org.key',
        'sslCertFile': '/home/isoron/SSL/sync.loophabits.org.crt',
        'heartbeatInterval': 300000,
        'heartbeatTimeout': 60000,
        'authTimeout': 5000,
        'rateLimitWindow': 600000,
        'rateLimitQuota': 600,
        "maxConnectionsPerKey": 10
    },

    'test': {
        'serverHostname': '::1',
        'serverPort': 4001,
        'databaseURL': 'postgres://localhost/habits_test',
        'sslKeyFile': '/home/isoron/SSL/sync.loophabits.org.key',
        'sslCertFile': '/home/isoron/SSL/sync.loophabits.org.crt',
        'heartbeatInterval': 300000,
        'heartbeatTimeout': 60000,
        'authTimeout': 100,
        'rateLimitWindow': 60000,
        'rateLimitQuota': 10,
        "maxConnectionsPerKey": 10
    }
};

module.exports = config[process.env.LOOP_ENV || 'production'];
