/*
   soldatabase.c
   Implementation of interface to Sol places database
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

#include "soldatabase.h"
#include <arpa/inet.h>
#include <ctype.h>
#include <errno.h>
#include <locale.h>
#include <xlocale.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <zlib.h>

#define MAGIC 0x534F4C21
#define BUF_SIZ 65536

#define TOC_INCR 256
#define LL_INCR 500
#define RL_INCR 250

#define LOG(msg) \
  do { \
    if (opt_v) { \
      fflush(stdout); \
      fprintf(stderr, "%s%s%s\n", \
        msgname?msgname:"", msgname?": ":"", (msg)); \
        fflush(stderr); \
    } \
  } while (0)

#define DIE(msg) \
  do { \
    fflush(stdout); \
    fprintf(stderr, "%s%s%s\n", \
      msgname?msgname:"", msgname?": ":"", (msg)); \
      fflush(stderr); \
      abort(); \
  } while (0)

#define SDB(x) ((soldbi_t *)(x))

typedef struct soldbi_s {
  gzFile gf;
  uint8_t *buf;
  size_t ptr;
  size_t ptr_max;
  size_t foffset;
  soldb_toc_t **toc_list;
  size_t toc_count;
  size_t toc_count_max;
  size_t data_start;
  size_t max_ll_size;
  locale_t locale;
} soldbi_t;

static int opt_v = 0;
static const char *msgname = NULL;

static void vLOGFi(int verbose, const char *msg, va_list args)
{
  if (verbose) {
    fflush(stdout);
    flockfile(stderr);
    if (msgname) fprintf(stderr, "%s: ", msgname);
    vfprintf(stderr, msg, args);
    fputs("\n", stderr);
    fflush(stderr);
    funlockfile(stderr);
  }
}

static void LOGF(const char *msg, ...)
{
  va_list args;
  va_start(args, msg);
  vLOGFi(opt_v, msg, args);
  va_end(args);
}

static void DIEF(const char *msg, ...)
{
  va_list args;
  va_start(args, msg);
  vLOGFi(1, msg, args);
  va_end(args);
  abort();
}

/* like bsearch but with qsort_r extension that takes a thunk for compar */
static void *mybsearch_r(
  const void *key, const void *base, size_t nel, size_t width, void *thunk,
  int (*compar)(void *, const void *, const void *))
{
  size_t low, high, mid;
  void *midptr;
  int result;

  if (!key || !base || !nel || !width || !compar)
    return NULL;
  
  low = 0;
  high = nel - 1;
  for (;;) {
    mid = (low + high) >> 1;
    midptr = (char *)base + (mid * width);
    result = (*compar)(thunk, key, midptr);
    if (result == 0)
      return midptr;
    if (result < 0) {
      if (low == mid) break;
      high = mid - 1;
    }
    else /* result > 0 */ {
      if (high == mid) break;
      low = mid + 1;
    }
  }
  return NULL;
}

void soldb_setverbose(int v)
{
  opt_v = v;
}

int soldb_getverbose(void)
{
  return opt_v;
}

void soldb_setname(const char *logname)
{
  msgname = logname;
}

const char *soldb_getname(void)
{
  return msgname;
}

/* returns void * to data for success, NULL for failure */
/* if peek is true, the location in the file is left unchanged */
/* can never read more than BUF_SIZ bytes */
static uint8_t *soldbi_readin(soldbi_t *db, size_t cnt, int peek)
{
  void *ans;
  if (cnt > BUF_SIZ)
    return NULL;
  if (cnt > db->ptr_max - db->ptr) {
    int incnt;
    if (db->ptr < db->ptr_max)
      memmove(db->buf, db->buf+db->ptr, db->ptr_max-db->ptr);
    db->ptr_max -= db->ptr;
    db->ptr = 0;
    incnt = gzread(db->gf, db->buf + db->ptr_max, BUF_SIZ);
    if (incnt <= 0)
      return NULL;
    db->ptr_max += (unsigned)incnt;
    if (cnt > db->ptr_max - db->ptr)
      return NULL;
  }
  ans = db->buf + db->ptr;
  if (!peek) {
    db->ptr += cnt;
    db->foffset += cnt;
  }
  return (uint8_t *)ans;    
}

static inline size_t soldbi_bufcnt(soldbi_t *db)
{
  return db->ptr_max - db->ptr;
}

/* Only whence=0 for SEEK_SET and whence=1 for SEEK_CUR are supported */
/* returns true for success, false for failure */
static bool soldbi_seekto(soldbi_t *db, size_t offset, int whence)
{
  size_t dest = offset;
  if (whence < 0 || whence > 1)
    return false; /* bad whence */
  if (whence)
    dest += db->foffset;
  if (dest < db->foffset)
    return false; /* can't seek backwards! */
  if (dest > db->foffset) {
    size_t move = dest - db->foffset;
    if (move > soldbi_bufcnt(db)) {
      move -= soldbi_bufcnt(db);
      db->foffset += soldbi_bufcnt(db);
      db->ptr = db->ptr_max = 0;
    }
    while (move >= BUF_SIZ) {
      if (!soldbi_readin(db, BUF_SIZ, 0))
        return false; /* hit EOF */
      move -= BUF_SIZ;
      db->ptr = db->ptr_max = 0;
    }
    if (!soldbi_readin(db, move, 0))
      return false; /* hit EOF */
  }
  return true; /* success */
}

static inline bool soldbi_seekdata(soldbi_t *db, size_t offset)
{
  return soldbi_seekto(db, db->data_start + offset, 0);
}

static bool soldbi_read_toc(soldbi_t *db)
{
  uint8_t *data;
  for (;;) {
    uint8_t len1, len2;
    uint8_t *str1, *str2, *off;
    soldb_toc_t *ent;
    uint32_t noff;

    if (!(data=soldbi_readin(db,1,1))) {
      LOG("unexpected EOF reading region name len");
      return false;
    }
    len1 = *data;
    if (!len1) break;
    if (!(data=soldbi_readin(db,1+len1+1,1))) {
      LOG("unexpected EOF reading zone name len");
      return false;
    }
    str1 = data + 1;
    len2 = data[1 + len1];
    if (!(data=soldbi_readin(db,1+len1+1+len2+4,0))) {
      LOG("unexpected EOF reading toc entry");
      return false;
    }
    str2 = data + 1 + len1 + 1;
    off = data + 1 + len1 + 1 + len2;
    ent = (soldb_toc_t *)malloc(
      sizeof(soldb_toc_t) + len1 + 1 + len2 + 2);
    if (!ent) {
      LOG("out of memory allocating soldb_toc_t plus strings");
      return false;
    }
    ent->region = (char *)ent + sizeof(soldb_toc_t);
    ent->zone = (char *)ent + sizeof(soldb_toc_t) + len1 + 1;
    ent->index = db->toc_count;
    memcpy(&noff, off, sizeof(noff));
    ent->offset = ntohl(noff);
    memcpy((char *)(ent->region), str1, len1);
    ((char *)(ent->region))[len1] = 0;
    memcpy(((char *)(ent->zone)), str2, len2);
    ((char *)(ent->zone))[len2] = 0;
    if (db->toc_count >= db->toc_count_max) {
      soldb_toc_t **newt = (soldb_toc_t **)
        realloc(db->toc_list,
                (db->toc_count_max + TOC_INCR) * sizeof(soldb_toc_t *));
      if (!newt) {
        LOG("out of memory allocating soldb_toc_t * array");
        free(ent);
        return false;
      }
      db->toc_list = newt;
      db->toc_count_max += TOC_INCR;
    }
    if (opt_v) {
      LOGF("TOC ENTRY: R=%s  Z=%s  O=0x%lX",
        ent->region, ent->zone, (unsigned long)ent->offset);
    }
    db->toc_list[db->toc_count++] = ent;
  }
  if (!(data=soldbi_readin(db,1,0))) {
    LOG("unexpected EOF reading TOC nul term");
    return false;
  }
  if (*data) {
    LOG("bad database format (missing 0 byte at end of TOC)");
    return false;
  }
  db->data_start = db->foffset;
  return true;
}

static void soldbi_free_toc(soldbi_t *db)
{
  size_t i;
  for (i=0; i < db->toc_count; ++i) {
    free(db->toc_list[i]);
  }
  free(db->toc_list);
  db->toc_list = NULL;
  db->toc_count = db->toc_count_max = 0;
}

static soldbi_t *soldbi_new(void)
{
  soldbi_t *newdb = (soldbi_t *)malloc(sizeof(soldbi_t) + 2*BUF_SIZ);
  if (!newdb) {
    LOG("out of memory allocating soldbi_t + buffer");
    return NULL;
  }
  newdb->gf = NULL;
  newdb->buf = (uint8_t *)newdb + sizeof(soldbi_t);
  newdb->ptr = 0;
  newdb->ptr_max = 0;
  newdb->foffset = 0;
  newdb->toc_list = NULL;
  newdb->toc_count = 0;
  newdb->toc_count_max = 0;
  newdb->data_start = 0;
  newdb->max_ll_size = 0;
  newdb->locale = newlocale(LC_ALL, "POSIX", NULL);
  if (!newdb->locale) {
    LOGF("error creating POSIX locale (%d): %s", errno, strerror(errno));
    free(newdb);
    return NULL;
  }
  return newdb;
}

static soldb_t soldbi_initdb(soldbi_t *newdb)
{
  void *data;
  uint32_t mag;

  if (!(data=soldbi_readin(newdb, sizeof(mag), 0))) {
    LOG("bad database format (could not read magic number)");
    gzclose(newdb->gf);
    freelocale(newdb->locale);
    free(newdb);
    return NULL;
  }
  memcpy(&mag, data, sizeof(mag));
  if (htonl(mag) != MAGIC) {
    LOG("bad database format (bad magic number)");
    gzclose(newdb->gf);
    freelocale(newdb->locale);
    free(newdb);
    return NULL;
  }
  if (!soldbi_read_toc(newdb)) {
    LOG("bad database format (could not read TOC)");
    soldbi_free_toc(newdb);
    gzclose(newdb->gf);
    freelocale(newdb->locale);
    free(newdb);
    return NULL;
  }
  if (!newdb->toc_count || !newdb->toc_list || !*newdb->toc_list) {
    LOG("bad database format (TOC has 0 entries)");
    soldbi_free_toc(newdb);
    gzclose(newdb->gf);
    freelocale(newdb->locale);
    free(newdb);
    return NULL;
  }
  return newdb;
}

soldb_t soldb_open(const char *dbfile)
{
  soldbi_t *newdb = soldbi_new();
  if (!newdb) return NULL;
  newdb->gf = gzopen(dbfile, "r");
  if (!newdb->gf) {
    LOGF("gzopen failed on file \"%s\"", dbfile);
    freelocale(newdb->locale);
    free(newdb);
    return NULL;
  }
  return soldbi_initdb(newdb);
}

soldb_t soldb_dopen(int fd)
{
  int duped = dup(fd);
  soldbi_t *newdb;
  if (duped == -1) {
    LOGF("invalid file handle: %d", fd);
    return NULL;
  }
  newdb = soldbi_new();
  newdb->gf = gzdopen(fd, "r");
  if (!newdb->gf) {
    LOGF("gzdopen failed on fd %d (dup of %d)", duped, fd);
    freelocale(newdb->locale);
    free(newdb);
    close(duped);
    return NULL;
  }
  return soldbi_initdb(newdb);
}

void soldb_close(soldb_t db)
{
  if (db) {
    soldbi_free_toc(SDB(db));
    gzclose(SDB(db)->gf);
    freelocale(SDB(db)->locale);
    free(db);
  }
}

size_t soldb_toccount(const soldb_t db)
{
  return SDB(db)->toc_count;
}

const soldb_toc_t *soldb_tocentry(const soldb_t db, size_t index)
{
  return SDB(db)->toc_list[index];
}

size_t soldb_maxllsize(const soldb_t db)
{
  return SDB(db)->max_ll_size;
}

static int soldbi_cmp_toc(void *l, const void *t1, const void *t2)
{
  #define L(x) ((locale_t)(x))
  #define CTOCEP(x) (*((const soldb_toc_t **)(x)))
  return strcasecmp_l(CTOCEP(t1)->region, CTOCEP(t2)->region, L(l));
  #undef CTOCEP
  #undef L
}

const soldb_toc_t *soldb_findregion(const soldb_t db, const char *region)
{
  soldb_toc_t **ans;
  soldb_toc_t finder;
  soldb_toc_t *finderp = &finder;
  finder.region = region;
  ans = (soldb_toc_t **)mybsearch_r(&finderp, SDB(db)->toc_list,
    SDB(db)->toc_count, sizeof(soldb_toc_t *), SDB(db)->locale, soldbi_cmp_toc);
  if (ans && *ans) {
    /* backup to first region with same name */
    while ((*ans)->index 
      && !strcasecmp_l((*ans)->region, (ans[-1])->region, SDB(db)->locale)) {
      --ans;
    }
  }
  return ans ? *ans : NULL;
}

/* return NULL on failure otherwise result needs to be free(..)'d by caller */
static soldb_latlon_t *soldbi_read_llentry_data(soldbi_t *db)
{
  size_t names, alts, strdata, tot, tsize;
  float lat, lon;
  uint8_t *data;
  char *strspace;
  uint8_t *nmspace;
  union {
    float f;
    uint8_t b[4];
    uint32_t u;
  } u;
  soldb_latlon_t *newl;

  names=alts=strdata=tot=0;
  for (;;) {
    if (!(data=soldbi_readin(db, tot+1, 1)))
      DIE("unexpected EOF reading name len byte");
    if (!data[tot]) break;
    if (data[tot] & 0x80) DIE("bad database format (name has 0x80 bit set)");
    strdata += data[tot] + 1;
    tot += 1 + data[tot];
    ++names;
    for (;;) {
      if (!(data=soldbi_readin(db, tot+1, 1)))
        DIE("unexpected EOF reading name len byte");
      if (!data[tot] || !(data[tot] & 0x80)) break;
      strdata += (data[tot] & 0x7F) + 1;
      tot += 1 + (data[tot] & 0x7F);
      ++alts;
    }
  }
  ++tot; /* eat the terminating 0 byte */
  if (!names) DIE("bad database format (LL had 0 names)");
  if (!(data=soldbi_readin(db, tot+8, 0)))
    DIE("unexpected EOF reading lat/lon");
  memcpy(&u.f, data+tot, 4);
  u.u = ntohl(u.u);
  lat = u.f;
  memcpy(&u.f, data+tot+4, 4);
  u.u = ntohl(u.u);
  lon = u.f;
  if (tot+8 > db->max_ll_size) db->max_ll_size = tot+8;

  tsize = (sizeof(soldb_latlon_t)-sizeof(soldb_name_t *))
          + names * sizeof(soldb_name_t *)
          + names * (sizeof(soldb_name_t)-sizeof(const char *))
          + alts * (sizeof(const char *));
  newl = (soldb_latlon_t *)malloc(tsize + strdata);
  if (!newl) DIE("out of memory");
  newl->latitude = lat;
  newl->longitude = lon;
  newl->toc = NULL; /* caller to fill in */
  newl->ncnt = 0;
  nmspace = (uint8_t *)newl
            + (sizeof(soldb_latlon_t)-sizeof(soldb_name_t *))
            + names * sizeof(soldb_name_t *);
  strspace = (char *)newl + tsize;

  for (;;) {
    uint8_t len = *data++;
    soldb_name_t *np;
    if (!len) break;
    np = (soldb_name_t *)nmspace;
    nmspace += (sizeof(soldb_name_t)-sizeof(const char *));
    memcpy(strspace, data, len);
    data += len;
    strspace[len] = 0;
    np->name = strspace;
    strspace += len + 1;
    np->acnt = 0;
    newl->names[newl->ncnt++] = np;
    for (;;) {
      if (!*data || !(*data & 0x80)) break;
      len = *data++ & 0x7F;
      memcpy(strspace, data, len);
      data += len;
      strspace[len] = 0;
      nmspace += sizeof(const char *);
      np->alts[np->acnt++] = strspace;
      strspace += len + 1;
    }
  }
  
  return newl;
}

soldb_region_t *soldb_readregion(
  const soldb_t db, const soldb_toc_t *ent, int oneonly)
{
  uint8_t *data;
  soldb_region_t *rec = NULL;
  size_t lcnt_max = 0;

  for (;;) {
    {
      size_t llcnt = 0;
      if (opt_v) {
        LOGF("Read RZ#%u %s %s @ 0x%lX (CUR 0x%lX)", (unsigned)ent->index,
          ent->region, ent->zone, (unsigned long)ent->offset,
          (unsigned long)(SDB(db)->foffset - SDB(db)->data_start));
      }
      if (!soldbi_seekdata(SDB(db), ent->offset))
        DIEF("failed seeking to TOC entry data (TO:0x%lX FROM:0x%lX)",
          (unsigned long)ent->offset,
          (unsigned long)(SDB(db)->foffset - SDB(db)->data_start));
      for (;;) {
        soldb_latlon_t *lrec;
        if (!(data=soldbi_readin(SDB(db), 1, 1)))
          DIE("unexpected EOF reading name len byte");
        if (!*data) break;
        if (!rec || rec->lcnt >= lcnt_max) {
          soldb_region_t *rnew = (soldb_region_t *)realloc(rec,
            (sizeof(soldb_region_t)-sizeof(soldb_latlon_t *))
            + (lcnt_max + LL_INCR) * sizeof(soldb_latlon_t *));
          if (!rnew) DIE("out of memory");
          if (!rec) rnew->lcnt = 0;
          rec = rnew;
          lcnt_max += LL_INCR;
        }
        
        lrec = soldbi_read_llentry_data(SDB(db));
        if (!lrec) DIE("failed to read ll entry data");
        lrec->toc = ent;
        rec->locs[rec->lcnt++] = lrec;
        ++llcnt;
      }
      if (!llcnt)
        DIE("bad database format (RZ data has no ll entries)");
      if (!(data=soldbi_readin(SDB(db), 1, 0)))
        DIE("unexpected EOF reading RZ terminator NUL");
      if (*data)
        DIE("bad database format (missing RZ terminator NUL)");
    }
    if (oneonly || ent->index + 1 >= SDB(db)->toc_count) break;
    {
      const soldb_toc_t *next = SDB(db)->toc_list[ent->index + 1];
      if (strcasecmp_l(ent->region, next->region, SDB(db)->locale)) break;
      ent = next;
    }
  }
  return rec;
}

void soldb_freeregion(soldb_region_t *region)
{
  size_t i;
  for (i=0; i<region->lcnt; ++i) {
    free(region->locs[i]);
  }
  free(region);
}

/* returns canonical name if match found, NULL if not */
static const char *soldbi_match_name(
  const soldb_latlon_t *loc, const char *nm, locale_t l)
{
  size_t i;
  if (!loc || !nm) return NULL;
  for (i=0; i<loc->ncnt; ++i) {
    const char *match = NULL;
    size_t j;
    const soldb_name_t *n = loc->names[i];
    if (!strcasecmp_l(nm, n->name, l))
      match = n->name;
    else
      for (j=0; j<n->acnt; ++j) {
        if (!strcasecmp_l(nm, n->alts[j], l)) {
          match = n->name;
          break;
        }
      }
    if (match) {
      if (strlen(loc->names[0]->name) > strlen(match)
          && tolower_l(loc->names[0]->name[0], l) == tolower_l(match[0], l))
        return loc->names[0]->name;
      else
        return match;
    }
  }
  return NULL;
}

static int soldbi_cmp_result(void *l, const void *t1, const void *t2)
{
  #define L(x) ((locale_t)(x))
  #define CRP(x) ((const soldb_result_t *)(x))
  return strcasecmp_l(CRP(t1)->name, CRP(t2)->name, L(l));
  #undef CRP
  #undef L
}

soldb_results_t *soldb_searchregion(
  const soldb_t db, const soldb_region_t *ent_data, const char *nm)
{
  soldb_results_t *rslt = NULL;
  size_t i, rcnt_max = 0;

  for (i=0; i < ent_data->lcnt; ++i) {
    soldb_latlon_t *l = ent_data->locs[i];
    const char *cname;
    if (nm)
      cname = soldbi_match_name(l, nm, SDB(db)->locale);
    else
      cname = l->names[0]->name;
    if (cname) {
      if (!rslt || rslt->rcnt >= rcnt_max) {
        soldb_results_t *rnew = realloc(rslt,
          (sizeof(soldb_results_t)-sizeof(soldb_result_t))
          + (rcnt_max + RL_INCR) * sizeof(soldb_result_t));
        if (!rnew) DIE("out of memory allocating results");
        if (!rslt) rnew->rcnt = 0;
        rslt = rnew;
        rcnt_max += RL_INCR;
      }
      ((soldb_result_t *)&rslt->results[rslt->rcnt])->name = cname;
      ((soldb_result_t *)&rslt->results[rslt->rcnt++])->loc = l;
    }
  }
  if (rslt && rslt->rcnt)
    qsort_r((void *)rslt->results, rslt->rcnt, sizeof(soldb_result_t),
      SDB(db)->locale, soldbi_cmp_result);
  return rslt;
}

void soldb_freeresults(soldb_results_t *results)
{
  free(results);
}
