//
//  TimeZoneHelper.m
//  TimeZoneHelper
//
//  Created by Dan Neumeyer on 2006-01-10
//  Copyright (C) 2006 Daniel S. Neumeyer
//  Portions Copyright (C) 2010,2011 Kyle J. McKay
//  All Rights Reserved
//
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//  * Redistributions of source code must retain the above copyright notice,
//    this list of conditions and the following disclaimer.
//  * Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//  * The names of the copyright holders or contributors may not be used to
//    endorse or promote products derived from this software without specific
//    prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
//

#import "TimeZoneHelper.h"
#import "soldatabase.h"
#import <AddressBook/AddressBook.h>
#import <Foundation/Foundation.h>
#import <WebKit/WebKit.h>
#import <stdio.h>
#import <stdlib.h>

@implementation TimeZoneHelper

typedef struct city_entry_s {
    const NSString *selected_city;
    const NSString *selected_country;
    const NSString *db_city;
    const NSString *db_region;
} city_entry_t;

static const city_entry_t city_table[222] = {
    #include "city_table.inc"
};
#define city_table_size (sizeof(city_table)/sizeof(city_table[0]))

static int compare_city(const void *p1, const void *p2)
{
  const city_entry_t *e1 = (const city_entry_t *)p1;
  const city_entry_t *e2 = (const city_entry_t *)p2;
  int cmp = [e1->selected_city caseInsensitiveCompare:
                                                (NSString *)e2->selected_city];
  if (cmp) return cmp;
  return [e1->selected_country caseInsensitiveCompare:
                                             (NSString *)e2->selected_country];
}

- (const city_entry_t *)lastSelectedCity
{
    city_entry_t search, *found;
    NSAutoreleasePool *pool = [NSAutoreleasePool new];
    NSArray *selectedCityPref =
        [[NSUserDefaults standardUserDefaults]
            arrayForKey: @"com.apple.TimeZonePref.Last_Selected_City"];
    if (!selectedCityPref)
    {
        [pool drain];
        return NULL;
    }
    if ([selectedCityPref count] < 7)
    {
        /* should have 9 or 10 elements but we only access indicies 5 & 6 */
        [pool drain];
        return NULL;
    }
    search.selected_city = (NSString *)[selectedCityPref objectAtIndex: 5];
    search.selected_country = (NSString *)[selectedCityPref objectAtIndex: 6];
    if (![search.selected_city isKindOfClass: [NSString class]]
        || ![search.selected_country isKindOfClass: [NSString class]])
    {
        [pool drain];
        return NULL;
    }
    found = (city_entry_t *)bsearch(&search, city_table, city_table_size,
        sizeof(city_entry_t), compare_city);
    [pool drain];
    return found;
}

- (id)initWithWebView:(WebView *)webview
{
    self = [super init];
    if (self)
    {
        _timeZone = [[NSTimeZone localTimeZone] retain];
        [NSDateFormatter setDefaultFormatterBehavior:NSDateFormatterBehavior10_4];
        _dbFile = [[[NSBundle bundleForClass: [self class]] resourcePath]
                   stringByAppendingPathComponent: @"database.gz"];
        [_dbFile retain];
        _lastRegion = [NSString stringWithString: @""];
        [_lastRegion retain];
        _lastName = [NSString stringWithString: @""];
        [_lastName retain];
        _lastResult = [NSString stringWithString: @"<s></s>"];
        [_lastResult retain];
#ifndef NDEBUG
        {
            const city_entry_t *sel_city = [self lastSelectedCity];
            if (sel_city)
            {
                NSLog(@"City: %@  Region: %@\n",
                    sel_city->db_city, sel_city->db_region);
            }
            else
                NSLog(@"No last selected city found\n");
        }
#endif
    }
    return self;
}

- (void)dealloc
{
    [_timeZone release];
    [_dbFile release];
    [_lastRegion release];
    [_lastName release];
    [_lastResult release];
    [super dealloc];
}

- (void)windowScriptObjectAvailable:(WebScriptObject *)windowScriptObject
{
    [windowScriptObject setValue:self forKey:@"TimeZoneHelper"];
}

+ (NSString *)webScriptNameForSelector:(SEL)aSelector
{
    if (aSelector == @selector(setTimeZoneWithName:))
        return @"setTimeZoneWithName";
    if (aSelector == @selector(formattedTimeForHours:))
        return @"formattedTimeForHours";
    if (aSelector == @selector(lookupPlaceInRegion:withName:))
        return @"lookupPlaceInRegionWithName";
    if (aSelector == @selector(log:))
        return @"log";

    return nil;
}

+ (BOOL)isSelectorExcludedFromWebScript:(SEL)aSelector
{
    if (aSelector == @selector(localTimeZoneName))
        return NO;
    if (aSelector == @selector(allTimeZones))
        return NO;
    if (aSelector == @selector(setTimeZoneWithName:))
        return NO;
    if (aSelector == @selector(timeOffsetHours))
        return NO;
    if (aSelector == @selector(formattedTimeForHours:))
        return NO;
    if (aSelector == @selector(myRegionCode))
        return NO;
    if (aSelector == @selector(myCityName))
        return NO;
    if (aSelector == @selector(lookupPlaceInRegion:withName:))
        return NO;
    if (aSelector == @selector(log:))
        return NO;

    return YES;
}

+ (BOOL)isKeyExcludedFromWebScript:(const char *)key
{
    return YES;
}

- (NSString *)localTimeZoneName
{
    return [[NSTimeZone localTimeZone] name];
}

- (NSArray *)allTimeZones
{
    return [NSTimeZone knownTimeZoneNames];
}

- (void)setTimeZoneWithName:(NSString *)name
{
    NSTimeZone *newTimeZone = [NSTimeZone timeZoneWithName:name];
    if (! newTimeZone) return;
    
    [_timeZone release];
    _timeZone = [newTimeZone retain];
}

- (double)timeOffsetHours
{
    return [_timeZone secondsFromGMT] / 3600.0;
}

- (NSString *)formattedTimeForHours:(double)hours
{
    NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
    [formatter setTimeZone:_timeZone];
    [formatter setTimeStyle:NSDateFormatterShortStyle];
    [formatter setDateStyle:NSDateFormatterNoStyle];
    
    unsigned wholeHours = floor(hours);
    unsigned minutes    = floor((hours - (double) wholeHours) * 60.0);
    unsigned seconds    = (hours * 60.0) - floor(hours * 60.0);
    
    NSCalendarDate *date = [NSCalendarDate calendarDate];
    [date setTimeZone:[NSTimeZone timeZoneWithAbbreviation:@"UTC"]];
    
    date = [[NSCalendarDate alloc] initWithYear:[date yearOfCommonEra]
                                          month:[date monthOfYear]
                                            day:[date dayOfMonth]
                                           hour:wholeHours
                                         minute:minutes
                                         second:seconds
                                       timeZone:[NSTimeZone timeZoneWithAbbreviation:@"UTC"]];
    
    NSString *formattedTime = [formatter stringFromDate:date];
    
    [formatter release];
    [date release];
    
    
    // This hack prevents layout issues when a German-speaking user has "Uhr" on the end of their time format.
    
    if ([formattedTime hasSuffix:@" Uhr"])
        formattedTime = [formattedTime substringToIndex:[formattedTime length] - 4];
    
    
    return formattedTime;
}

- (NSString *)myRegionCode
{
    const city_entry_t *lastCity = [self lastSelectedCity];
    if (lastCity) return (NSString *)lastCity->db_region;

    ABPerson *me = [[ABAddressBook sharedAddressBook] me];
    if (! me) return nil;
    
    ABMultiValue *addresses = [me valueForProperty:kABAddressProperty];
    NSDictionary *primaryAddress = [addresses valueAtIndex:[addresses indexForIdentifier:[addresses primaryIdentifier]]];
    
    NSString *countryCodeISO = [[primaryAddress objectForKey:kABAddressCountryCodeKey] uppercaseString];
    
    if ([countryCodeISO isEqualToString:@"US"])
    {
        NSString *stateCode = [primaryAddress objectForKey:kABAddressStateKey];
        if (! stateCode) return nil;
        return [NSString stringWithFormat:@"%@/%@", countryCodeISO, stateCode];
    }
    else
        return countryCodeISO;
}

- (NSString *)myCityName
{
    const city_entry_t *lastCity = [self lastSelectedCity];
    if (lastCity) return (NSString *)lastCity->db_city;

    ABPerson *me = [[ABAddressBook sharedAddressBook] me];
    if (! me) return nil;
    
    ABMultiValue *addresses = [me valueForProperty:kABAddressProperty];
    NSDictionary *primaryAddress = [addresses valueAtIndex:[addresses indexForIdentifier:[addresses primaryIdentifier]]];
    
    return [primaryAddress objectForKey:kABAddressCityKey];
}

- (NSString *)lookupPlaceInRegion:(NSString *)region withName:(NSString *)name
{
    /*
     * Output format is <s></s> top-level element containing zero or more
     *   <r><n>name</n><a>latitude</a><o>longitude</o><t>time_zone</t></r>
     * compound elements.
     */
    soldb_t db;
    NSString *result = @"<s>";

    if ([_lastRegion isEqualToString: region]
        && [_lastName isEqualToString: name])
      return _lastResult;

    [_lastRegion release];
    _lastRegion = [NSString stringWithString: region];
    [_lastRegion retain];
    [_lastName release];
    _lastName = [NSString stringWithString: name];
    [_lastName retain];

#ifndef NDEBUG
    NSLog(@"DBFile is %@\n", _dbFile);
    NSLog(@"LOOKUP: Region=\"%@\" Name=\"%@\"\n", region, name);
#endif
    db = soldb_open([_dbFile fileSystemRepresentation]);
    if (db) {
      const soldb_toc_t *rz = soldb_findregion(db, [region UTF8String]);
      if (rz) {
        soldb_region_t *region = soldb_readregion(db, rz, 0);
#ifndef NDEBUG
        NSLog(@"Found RZ: %s %s\n", rz->region, rz->zone);
#endif
        if (region) {
          soldb_results_t *results = soldb_searchregion(db, region,
            [name UTF8String]);
#ifndef NDEBUG
          NSLog(@"Read region with %lu LatLon locations\n",
            (unsigned long)region->lcnt);
#endif
          if (results) {
            size_t i;
#ifndef NDEBUG
            NSLog(@"Found %lu results!\n", (unsigned long)results->rcnt);
#endif
            for (i=0; i < results->rcnt; ++i) {
              /* Place names are limited to 127 chars, timezones to 255, so
               * allowing overhead for the XML tags and rounding up we get 512
               */
              char row[512]; /* enough in all cases for a row */
              snprintf(row, sizeof(row),
                "<r><n>%s</n><a>%.7g</a><o>%.7g</o><t>%s</t></r>",
                results->results[i].name,
                results->results[i].loc->latitude,
                results->results[i].loc->longitude,
                results->results[i].loc->toc->zone);
              result = [result stringByAppendingString:
                [NSString stringWithUTF8String: row]];
            }
            soldb_freeresults(results);
          }
          soldb_freeregion(region);
        }
      }
      soldb_close(db);
    }
    result = [result stringByAppendingString: @"</s>"];
#ifndef NDEBUG
    NSLog(@"Results:\n%@\n", result);
#endif

    [_lastResult release];
    _lastResult = result;
    [_lastResult retain];

    return result;
}

- (void)log:(NSString *)msg
{
    NSLog(@"%@\n", msg ? msg : @"");
}

@end
