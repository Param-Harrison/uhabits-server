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

exports.register =
{
    'type': 'object',
    'properties': {
        'groupKey': {
            'type': 'string',
            'minLength': 32,
            'maxLength': 32
        }
    },
    'required': ['groupKey']
};

exports.auth =
{
    'type': 'object',
    'properties': {
        'groupKey': {
            'type': 'string'
        },
        'clientId': {
            'type': 'string'
        },
        'version': {
            'type': 'string'
        }
    },
    'required': ['groupKey', 'clientId']
};

exports.postEvent =
{
    'type': 'object',
    'properties': {
        'id': {
            'type': 'string'
        },
        'data': {
            'type': 'object',
            'maxProperties': 100
        },
        'event': {
            'type': 'string',
            'maxLength': 100
        }
    },
    'required': ['id', 'data', 'event']
};

exports.postSnapshot =
{
    'type': 'object',
    'properties': {
        'id': {
            'type': 'string'
        },
        'data': {
            'type': 'object',
            'maxProperties': 100
        }
    },
    'required': ['id', 'data']
};

exports.fetch =
{
    'type': 'object',
    'properties': {
        'since': {
            'type': 'number'
        }
    },
    'required': ['since']
};