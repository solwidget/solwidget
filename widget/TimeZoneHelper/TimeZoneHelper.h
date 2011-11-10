//
//  TimeZoneHelper.h
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

#import <Cocoa/Cocoa.h>


@interface TimeZoneHelper : NSObject
{
    NSTimeZone *_timeZone;
    NSString *_dbFile;
    NSString *_lastRegion;
    NSString *_lastName;
    NSString *_lastResult;
}

- (NSString *)localTimeZoneName;
- (NSArray *)allTimeZones;

- (void)setTimeZoneWithName:(NSString *)name;
- (double)timeOffsetHours;
- (double)timeOffsetHoursForDate:(double)dateMillis;
- (NSString *)formattedTimeForHours:(double)hours;
- (NSString *)lookupPlaceInRegion:(NSString *)region withName:(NSString *)name;

- (NSString *)myRegionCode;
- (NSString *)myCityName;

- (void)log:(NSString *)msg;

@end
