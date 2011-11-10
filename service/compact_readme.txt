compact_readme.txt - Description of special format compact places database file
Copyright (C) 2010,2011 Kyle J. McKay.  All rights reserved.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

In order to include the database with the widget, it has to be compressed as
much as possible.

The compressed version is generated with the following format:

TOC|DATA

The TOC consists of:

  REGION|TIMEZONE|OFFSET
  ...
  0

Where REGION and TIMEZONE are pascal UTF-8 strings and OFFSET is a network
byte order uint32_t offset into data where offset 0 represents the initial
byte of the DATA section.

The DATA for each REGION|TIMEZONE consists of:

  NAME[|ALT...]...|0|LATITUDE|LONGITUDE
  ...
  0

Where NAME is a pascal UTF-8 string of 127 bytes or less in length.  If ALT is
present, it is a UTF-8 string of 127 bytes or less with the high bit set on
the length byte.  LATITUDE and LONGITUDE are IEEE-754 single precision floats
in network byte order.

Finally, the resulting compressed data file is run through gzip -9 to further
make it as small as possible.

The perl script compact_make_db generates a database.gz file in this format
from the database created with the database_make_sql script.  It takes about
7 minutes to create the compressed, compact database which ends up being about
20 megabytes in size and is included with the Sol widget distribution.
