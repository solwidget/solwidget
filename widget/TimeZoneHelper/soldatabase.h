/*
   soldatabase.h
   Interface to Sol places database
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
*/

#ifndef SOLDATABASE_H
#define SOLDATABASE_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct soldb_toc_s {
  const char *region;
  const char *zone;
  size_t index; /* which toc entry this is */
  size_t offset; /* used internally */
} soldb_toc_t;

typedef struct soldb_name_s {
  const char *name;
  size_t acnt; /* may be zero */
  const char *alts[1]; /* size varies, has exactly acnt elements */
} soldb_name_t;

typedef struct soldb_latlon_s {
  float latitude;
  float longitude;
  const soldb_toc_t *toc; /* which toc entry is associated with this latlon */
  size_t ncnt; /* will abort before returning a zero count here */
  const soldb_name_t *names[1]; /* size varies, has exactly ncnt elements */
} soldb_latlon_t;

typedef struct soldb_region_s {
  size_t lcnt; /* may not be zero */
  soldb_latlon_t *locs[1];
} soldb_region_t;

typedef struct soldb_result_s {
  const char *name; /* the canonical version of the matching name */
  const soldb_latlon_t *loc; /* the matching location */
} soldb_result_t;

typedef struct soldb_results_s {
  size_t rcnt; /* may not be zero */
  const soldb_result_t results[1]; /* size varies, has exactly rcnt elements */
} soldb_results_t;

typedef void *soldb_t;

void soldb_setverbose(int);
int soldb_getverbose(void);
void soldb_setname(const char *);
const char *soldb_getname(void);

soldb_t soldb_open(const char *dbfile);
soldb_t soldb_dopen(int fd); /* fd is always dup'd first */

size_t soldb_toccount(const soldb_t db);
const soldb_toc_t *soldb_tocentry(const soldb_t db, size_t index);

/* If found, result is first record for that region in the TOC */
const soldb_toc_t *soldb_findregion(const soldb_t db, const char *region);

/* if oneonly is true (non-zero) only the one timezone is returned (probably
 * NOT what you want, when false (0) all following TOC records with the same
 * region name are also read (most likely what you DO want).
 */
soldb_region_t *soldb_readregion(const soldb_t db,
                                 const soldb_toc_t *rtoc,
                                 int oneonly /* use 0 unless you're sure */);

soldb_results_t *soldb_searchregion(const soldb_t db,
                                    const soldb_region_t *reg,
                                    const char *nm);
void soldb_freeresults(soldb_results_t *results);

void soldb_freeregion(soldb_region_t *region);

size_t soldb_maxllsize(const soldb_t db);
void soldb_close(soldb_t db);

#ifdef __cplusplus
}
#endif

#endif /* SOLDATABASE_H */
