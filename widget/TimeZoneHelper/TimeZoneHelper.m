//
//  TimeZoneHelper.m
//  TimeZoneHelper
//
//  Created by Dan Neumeyer on 1/10/06.
//  Copyright 2006 __MyCompanyName__. All rights reserved.
//

#import "TimeZoneHelper.h"
#import <WebKit/WebKit.h>
#import <AddressBook/AddressBook.h>


@implementation TimeZoneHelper

- (id)initWithWebView:(WebView *)webview
{
	self = [super init];
	if (self)
	{
		_timeZone = [[NSTimeZone localTimeZone] retain];
		[NSDateFormatter setDefaultFormatterBehavior:NSDateFormatterBehavior10_4];
	}
	return self;
}

- (void)dealloc
{
	[_timeZone release];
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

- (float)timeOffsetHours
{
	return [_timeZone secondsFromGMT] / 3600.0;
}

- (NSString *)formattedTimeForHours:(float)hours
{
	NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
	[formatter setTimeZone:_timeZone];
	[formatter setTimeStyle:NSDateFormatterShortStyle];
	[formatter setDateStyle:NSDateFormatterNoStyle];
	
	unsigned wholeHours = floor(hours);
	unsigned minutes    = floor((hours - (float) wholeHours) * 60.0);
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
	
	
	// This hack prevents layout issues when a German-speaking user has "Uhr" on the end of their time format.
	
	if ([formattedTime hasSuffix:@" Uhr"])
		formattedTime = [formattedTime substringToIndex:[formattedTime length] - 4];
	
	
	return formattedTime;
}

- (NSString *)myRegionCode
{
	static NSDictionary *mapISOToFIPS10_4 = nil;
	
	if (! mapISOToFIPS10_4)
		mapISOToFIPS10_4 = [[NSDictionary alloc] initWithObjectsAndKeys:
			@"AE", @"ae",
			@"AR", @"ar",
			@"AU", @"at",
			@"AS", @"au",
			@"BK", @"ba",
			@"BE", @"be",
			@"BA", @"bh",
			@"BR", @"br",
			@"CA", @"ca",
			@"SZ", @"ch",
			@"CH", @"cn",
			@"EZ", @"cs",
			@"GM", @"de",
			@"DA", @"dk",
			@"EG", @"eg",
			@"SP", @"es",
			@"FI", @"fi",
			@"FR", @"fr",
			@"GL", @"gl",
			@"GR", @"gr",
			@"HK", @"hk",
			@"HR", @"hr",
			@"HU", @"hu",
			@"EI", @"ie",
			@"IS", @"il",
			@"ID", @"id",
			@"IN", @"in",
			@"IC", @"is",
			@"IT", @"it",
			@"JA", @"ja",
			@"JO", @"jo",
			@"KS", @"kr",
			@"KU", @"kw",
			@"LE", @"lb",
			@"LU", @"lu",
			@"MK", @"mk",
			@"MX", @"mx",
			@"NL", @"nl",
			@"NO", @"no",
			@"NZ", @"nz",
			@"MU", @"om",
			@"PL", @"pl",
			@"PO", @"pt",
			@"QA", @"qa",
			@"RO", @"ro",
			@"RS", @"ru",
			@"SA", @"sa",
			@"SW", @"se",
			@"SN", @"sg",
			@"SI", @"si",
			@"LO", @"sk",
			@"SY", @"sy",
			@"TU", @"tr",
			@"TW", @"tw",
			@"UP", @"ua",
			@"UK", @"uk",
			@"US", @"us",
			@"YM", @"ye",
			@"YI", @"yu",
			@"SF", @"za",
			nil];
	
	ABPerson *me = [[ABAddressBook sharedAddressBook] me];
	if (! me) return nil;
	
	ABMultiValue *addresses = [me valueForProperty:kABAddressProperty];
	NSDictionary *primaryAddress = [addresses valueAtIndex:[addresses indexForIdentifier:[addresses primaryIdentifier]]];
	
	NSString *countryCodeFIPS10_4 = [mapISOToFIPS10_4 objectForKey:[primaryAddress objectForKey:kABAddressCountryCodeKey]];
	
	if ([countryCodeFIPS10_4 isEqualToString:@"US"])
	{
		NSString *stateCode = [primaryAddress objectForKey:kABAddressStateKey];
		if (! stateCode) return nil;
		return [NSString stringWithFormat:@"%@/%@", countryCodeFIPS10_4, stateCode];
	}
	else
		return countryCodeFIPS10_4;
}

- (NSString *)myCityName
{
	ABPerson *me = [[ABAddressBook sharedAddressBook] me];
	if (! me) return nil;
	
	ABMultiValue *addresses = [me valueForProperty:kABAddressProperty];
	NSDictionary *primaryAddress = [addresses valueAtIndex:[addresses indexForIdentifier:[addresses primaryIdentifier]]];
	
	return [primaryAddress objectForKey:kABAddressCityKey];
}

@end
