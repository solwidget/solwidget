/*
   database_test.c version 1.0.0
   Tests reading and searching the compressed, compact database
   Copyright (C) 2010 Kyle J. McKay.  All rights reserved.

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
   
   gcc -isysroot /Developer/SDKs/MacOSX10.4u.sdk -mmacosx-version-min=10.4 \
     -I../widget/TimeZoneHelper -o database_test -lz \
     -Wall -Wextra -O0 -g database_test.c

   database_test -f database.gz fr vern
*/

#include "soldatabase.h"
#include <signal.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define DIE(msg) \
  do {fprintf(stderr,"%s: %s\n",me,(msg)); fflush(stderr); abort();} while (0)

static const char *me;
static int opt_v;
static soldb_t g_db;

/* returns canonical name if match found, NULL if not */
static const char *match_name(const soldb_latlon_t *loc, const char *nm)
{
  size_t i;
  if (!loc || !nm) return NULL;
  for (i=0; i<loc->ncnt; ++i) {
    size_t j;
    const soldb_name_t *n = loc->names[i];
    if (!strcasecmp(nm, n->name))
      return n->name;
    for (j=0; j<n->acnt; ++j) {
      if (!strcasecmp(nm, n->alts[j]))
        return n->name;
    }
  }
  return NULL;
}

static void show_loc(const soldb_latlon_t *l, const char *p)
{
  size_t i;
  if (!p) p="";
  printf("%s%.7g,%.7g %s %s:\n",
    p, l->latitude, l->longitude, l->toc->region, l->toc->zone);
  for (i=0; i<l->ncnt; ++i) {
    size_t j;
    const soldb_name_t *n = l->names[i];
    printf("%s  %s%s", p, n->name, n->acnt ? " (" : "");
    for (j=0; j<n->acnt; ++j) {
      printf("%s%s", j?", ":"", n->alts[j]);
    }
    printf("%s\n", n->acnt ? ")" : "");
  }
}

static void search_toc_entry(const soldb_toc_t *ent, const char *nm, int one)
{
  soldb_region_t *ent_data;
  soldb_results_t *results;
  size_t i;

  if (opt_v) {
    if (nm)
      printf("SEARCH R=%s Z=%s MATCH=%s\n", ent->region, ent->zone, nm);
    else
      printf("SEARCH R=%s Z=%s\n", ent->region, ent->zone);
  }
  ent_data = soldb_readregion(g_db, ent, one);
  if (!ent_data) DIE("failed reading entry data");
  for (i=0; i < ent_data->lcnt; ++i) {
    soldb_latlon_t *l = ent_data->locs[i];
    if (!nm || match_name(l, nm))
      show_loc(l, "");
  }
  results = soldb_searchregion(g_db, ent_data, nm);
  if (results) {
    for (i=0; i< results->rcnt; ++i) {
      const soldb_result_t *r = &results->results[i];
      printf("\"%s\" -> %s %.7g,%.7g %s %s\n",
        nm?nm:"", r->name, r->loc->latitude, r->loc->longitude,
        r->loc->toc->region, r->loc->toc->zone);
    }
    soldb_freeresults(results);
  }
  
  soldb_freeregion(ent_data);
}

static void leaks_helper(const char *msg)
{
  if (getenv("MallocStackLogging")) {
    int sig;
    sigset_t oldsigs;
    sigset_t waitsigs;
    fflush(stdout);
    fflush(stderr);
    fprintf(stderr, 
      "%s%sMallocStackLogging set waiting for SIGINT or SIGTERM (pid %u)\n",
      msg?msg:"", msg?": ":"", (unsigned)getpid());
    fflush(stderr);
    sigemptyset(&waitsigs);
    sigaddset(&waitsigs, SIGINT);
    sigaddset(&waitsigs, SIGTERM);
    sigprocmask(SIG_BLOCK, &waitsigs, &oldsigs);
    sigaddset(&waitsigs, SIGCONT); /* Mac OS X bug workaround */
    while (sigwait(&waitsigs, &sig)==0 && sig==SIGCONT) /* more workaround */ {}
    sigprocmask(SIG_SETMASK, &oldsigs, NULL);
  }
}

static void leaks_atexit(void)
{
  leaks_helper("ATEXIT");
}

int main(int argc, char **argv)
{
  int help = 0;

  atexit(leaks_atexit);
  {
    const char *met, *name = __FILE__;
    if (argc && *argv && **argv) name = *argv;
    met = strrchr(name, '/');
    if (met && *met && met[1])
      me = met+1;
    else
      me = name;
    if (argc) {
      --argc;
      ++argv;
    }
    soldb_setname(me);
  }
  
  while (argc && (!strcmp(*argv, "-v") || !strcmp(*argv, "--verbose"))) {
    ++opt_v;
    --argc;
    ++argv;
  }
  soldb_setverbose(opt_v);

  if (argc && (!strcmp(*argv, "-f") || !strcmp(*argv, "--file"))) {
    if (argc < 2) {
      fprintf(stderr, "%s: bad parameters, try %s --help\n", me, me);
      return 1;
    }
    g_db = soldb_open(argv[1]);
    if (!g_db) {
      fprintf(stderr, "%s: soldb_open failed on file \"%s\"\n", me, argv[1]);
      return 1;
    }
    argc -= 2;
    argv += 2;
  }
  else {
    g_db = soldb_dopen(STDIN_FILENO);
    if (!g_db) {
      fprintf(stderr, "%s: soldb_dopen failed on STDIN_FILENO\n", me);
      return 1;
    }
  }

  if (argc && (!strcmp(*argv, "-h") || !strcmp(*argv, "--help")))
    help = 1;
  if (help || argc > 2) {
    fprintf(stderr,
      "Usage: %s [-v] [-h] -f db.gz / < db.gz [region_name [city_name]]\n", me);
    return 1;
  }

  if (argc >= 1) {
    const soldb_toc_t *ent = soldb_findregion(g_db, *argv);
    if (!ent) {
      fprintf(stderr, "%s: region name \"%s\" not found in database\n",
        me, *argv);
      return 1;
    }
    search_toc_entry(ent, argc >= 2 ? argv[1] : NULL, 0);
  }
  else {
    size_t i;
    for (i=0; i < soldb_toccount(g_db); ++i) {
      search_toc_entry(soldb_tocentry(g_db, i), NULL, 1);
    }
  }

  printf("Max size of lat/lon record was %lu bytes\n",
    (unsigned long)soldb_maxllsize(g_db));

  soldb_close(g_db);
  return 0;
}

#undef DIE
#include "soldatabase.c"
