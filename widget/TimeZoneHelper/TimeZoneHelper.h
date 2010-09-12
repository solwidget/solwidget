//
//  TimeZoneHelper.h
//  TimeZoneHelper
//
//  Created by Dan Neumeyer on 1/10/06.
//  Copyright 2006 __MyCompanyName__. All rights reserved.
//

#import <Cocoa/Cocoa.h>


@interface TimeZoneHelper : NSObject
{
	NSTimeZone *_timeZone;
}

- (NSString *)localTimeZoneName;
- (NSArray *)allTimeZones;

- (void)setTimeZoneWithName:(NSString *)name;
- (float)timeOffsetHours;
- (NSString *)formattedTimeForHours:(float)hours;

- (NSString *)myRegionCode;
- (NSString *)myCityName;

@end
