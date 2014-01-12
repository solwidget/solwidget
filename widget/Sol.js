//
//  Sol.js
//  Logic for Sol
//
//  Copyright (C) 2006 Daniel S. Neumeyer
//  Portions Copyright (C) 2010,2011,2014 Kyle J. McKay
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


// Version number. If you change this, also change Info.plist.

var gVersion = '1.3.4';


// Last lookup (not validated)

var gLookupName;
var gLookupStateName;
var gLookupCountryName;
var gLookupCountryCode;


// Last valid lookup, Location and GMT offset of selected location.

var gPlaceName;
var gStateName;
var gCountryName;
var gCountryCode;
var gLatitude;
var gLongitude;


// Buttons... not actually used after instantiation.

var gDoneButton;
var gWhiteInfoButton;


// Whether only the clock is showing, and the widget's original width.

var gClockOnly;
var gExpandedWidth;
var gFrontSizeAdjust;
var gBackSizeAdjust;
var gFrontHeight = 163;
var gBackHeight = 180;


// Whether to show the midday time
var gShowMidday;


// Timer for periodic updates.

var gClockTimeout = false;


// XML request object.

var gCityRequest = false;


// Load clock hand images.

var gClockHand = new Image();
gClockHand.src = 'ClockHand.png';

var gClockHandShadow = new Image();
gClockHandShadow.src = 'ClockHandShadow.png';


// Save settings for ESCape

var gSavedSettings = {}


// -- message --
//
// Output message to the log, either system log or console log
function message(s)
{
    try {
        if (window.widget) {
            // Running in Dashboard, must use window.alert
            window.alert(s);
        }
        else {
            // Not running in Dashboard, send to console
            window.console.log(s)
        }
    }
    finally {}
}


// -- CountryDidChange --
//
// Handles onchange event from the country menu. Shows or hides the state menu.
//
function CountryDidChange()
{
    var countryMenu = document.getElementById('country');

    document.getElementById('stateRow').style.display =
        countryMenu.options[countryMenu.selectedIndex].value == 'US'
        ? 'table-row'
        : 'none';
}


// -- TwilightDidChange --
//
// Handles onchange event from the twilight menu. Adjusts the twilight icon
//
function TwilightDidChange()
{
    if (gClockOnly)
    {
        document.getElementById('twilightIcon').style.display = 'none';
    }
    else
    {
        var twilightMenu = document.getElementById('twilight');
        var option = twilightMenu.options[twilightMenu.selectedIndex].id;
        if (option == 'nauticalOption')
        {
            document.getElementById('twilightImg').src = "anchor.png";
            document.getElementById('twilightIcon').style.display = 'block';
        }
        else if (option == 'astronomicalOption')
        {
            document.getElementById('twilightImg').src = "telescope.png";
            document.getElementById('twilightIcon').style.display = 'block';
        }
        else
        {
            document.getElementById('twilightIcon').style.display = 'none';
        }
    }
}


// -- MiddayDidChange --
//
// Handle changes to the show midday setting
//
function MiddayDidChange()
{
    gShowMidday = document.getElementById('midday').checked;
    widget.setPreferenceForKey(gShowMidday, widget.identifier + '-showMidday');
}


// -- *D ---
//
// These trigonometry functions use degrees instead of radians.
//
function sinD(n)  { return Math.sin (n * 0.0174532925199433); }
function cosD(n)  { return Math.cos (n * 0.0174532925199433); }
function tanD(n)  { return Math.tan (n * 0.0174532925199433); }
function asinD(n) { return Math.asin(n) * 57.2957795130823;   }
function acosD(n) { return Math.acos(n) * 57.2957795130823;   }
function atanD(n) { return Math.atan(n) * 57.2957795130823;   }


function Int(n) { return n < 0 ? Math.ceil(n) : Math.floor(n); }
function Sign(n) { if (n < 0) return -1; if (n > 0) return 1; return 0; }


// -- isNull --
//
// Determines whether an object is null.
//
function isNull(anObject)
{
    return typeof anObject == "object" && !anObject;
}


// -- isBackSide --
//
// Determines whether or not the back side is showing
//
function isBackSide()
{
    return document.getElementById('front').style.display == 'none';
}


// --- CalculateSunriseOrSunset ---
//
// Calculates the time of sunrise or sunset at a given location on a given day.
//
// Parameters
//    latitude - latitude in degrees of location
//   longitude - longitude in degrees of location
//        date - milliseconds since 1970 of time on day to calculate times for
//     sunrise - Boolean value indicating whether to calculate sunrise (true) or sunset (false)
//    twilight - Boolean value indicating whether to calculate twilight (true) or sunrise/sunset (false)
//
//   NOTE: date is treated as UTC and the UTC day, month and year is then extracted to indicate
//         which day to calculate the sunrise/sunset for.  If, for example, the current time
//         is 1700 hrs local time and local time is 8 hours behind UTC, then passing in the
//         current time's date.getTime() would result in calculating the sunrise/sunset for the
//         day after since 1700 hrs local time in a time zone 8 hours behind UTC is actually
//         0100 hrs the day after in UTC.
//
// Returns
//   milliseconds since 1970 GMT of event, or null if the event doesn't occur on the given day
//   can also return NaN to indicate the event doesn't occur on the given day but is still ongoing
//   (use new Date(return_value) to get a Date object if the result is not null and not NaN)
//
function CalculateSunriseOrSunset(latitude, longitude, date, sunrise, twilight)
{
    // Source:
    //   Almanac for Computers, 1990
    //   published by Nautical Almanac Office
    //   United States Naval Observatory
    //   Washington, DC 20392

    var utc = new Date(date);
    utc.setUTCHours(0, 0, 0, 0); // For later use in computing return value
    var day   = utc.getUTCDate();
    var month = utc.getUTCMonth() + 1;
    var year  = utc.getUTCFullYear();

    var zenith;

    if (twilight)
    {
        var twilightSelect = document.getElementById('twilight');
        zenith = twilightSelect.value;
    }
    else
        zenith = 90.8333333333;


    // Calculate the day of the year.

    var N1 = Math.floor(275.0 * month / 9.0);
    var N2 = Math.floor((month + 9.0) / 12.0);
    var N3 = 1.0 + Math.floor((year - 4.0 * Math.floor(year / 4.0) + 2.0) / 3.0);
    var N = N1 - (N2 * N3) + day - 30.0;


    // Convert the longitude to hour value and calculate an approximate time.

    var lngHour, t;

    lngHour = longitude / 15.0;

    if (sunrise)
        t = N + ((6.0 - lngHour) / 24.0);
    else
        t = N + ((18.0 - lngHour) / 24.0)


    // Calculate the sun's mean anomaly.

    var M = (0.9856 * t) - 3.289;


    // Calculate the sun's true longitude.

    var L = M + (1.916 * sinD(M)) + (0.020 * sinD(2 * M)) + 282.634;

    while (L >= 360) L -= 360.0;
    while (L <  0)   L += 360.0;


    // Caculate the sun's right ascension.

    var RA = atanD(0.91764 * tanD(L));

    while (RA >= 360) RA -= 360.0;
    while (RA <  0)   RA += 360.0;


    // Right ascension value needs to be in the same quadrant as L.

    var Lquadrant = Math.floor(L / 90.0) * 90.0;
    var RAquadrant = Math.floor(RA / 90.0) * 90.0;
    RA = RA + (Lquadrant - RAquadrant);


    // Right ascension value needs to be converted into hours.

    RA /= 15.0;


    // Calculate the sun's declination.

    var sinDec = 0.39782 * sinD(L);
    var cosDec = cosD(asinD(sinDec));


    // Calculate the sun's local hour angle.

    var cosH = (cosD(zenith) - (sinDec * sinD(latitude))) / (cosDec * cosD(latitude));

    if (sunrise)
    {
        if (cosH > 1) return null;
    }
    else
    {
        if (cosH < -1) return null;
    }


    // Finish calculating H and convert into hours.

    var H;

    if (sunrise)
        H = 360.0 - acosD(cosH);
    else
        H = acosD(cosH);

    H /= 15.0


    // Calculate local mean time of rising.

    var T = H + RA - (0.06571 * t) - 6.622;


    // Normalize to [0,24) range

    while (T >= 24) T -= 24.0;
    while (T <  0)  T += 24.0;


    // Adjust back to UTC.

    var UT = T - lngHour;

    return utc.getTime() + (UT * 3600000.0);  // multiply UT by milliseconds per hour
}


// --- CalculateMoonriseOrMoonset ---
//
// Calculates the time of moonrise or moonset at a given location on a given day.
// I have no idea how this works. :-)
//
// Parameters
//    latitude - latitude in degrees of location
//   longitude - longitude in degrees of location
//        date - Date object representing day to calculate
//    moonrise - Boolean value indicating whether to calculate moonrise (true) or moonset (false)
//
// Returns
//   floating-point hour of moon event in UTC (e.g., 5.15 => 0509Z), or null if the event doesn't occur on the given day; if neither event occurs, a third element indicates whether the moon is visible
//
// TODO: Needs to be converted to have i/o UTC millis like CalculateSunriseOrSunset in order to be used
function CalculateMoonriseOrMoonset(latitude, longitude, date, moonrise)
{
    // Source: Sky & Telescope magazine, July 1989, p78

    day   = date.getDate();
    month = date.getMonth() + 1;
    year  = date.getFullYear();

    longitude /= 360.0;


    var P1 = 3.14159265;
    var P2 = 2.0 * P1;
    var R1 = P1 / 180.0;
    var K1 = 15.0 * R1 * 1.0027379;

    var M = new Array(new Array(4), new Array(4), new Array(4), new Array(4));


    J = -Int(7.0 * (Int((month + 9.0) / 12.0) + year) / 4.0);

    S = Sign(month - 9);
    A = Math.abs(month - 9);
    J3 = Int(year + S * Int(A / 7.0));
    J3 = -Int((Int(J3 / 100.0) + 1.0) * 3.0 / 4.0);

    J += Int(275.0 * month / 9.0) + day + J3
        + 1721028.0 + 367.0 * year;

    T = (J - 2451545.0) + 0.5;


    T0 = T / 36525.0;
    S = 24110.5 + 8640184.813 * T0 + 86400.0 * longitude;
    S /= 86400.0;
    S -= Int(S);
    T0 = S * 360.0 * R1;


    for (I = 1; I <= 3; I++)
    {
        L = 0.606434 + 0.03660110129 * T;
        M0 = 0.374897 + 0.03629164709 * T;
        F = 0.259091 + 0.03674819520 * T;
        D = 0.827362 + 0.03386319198 * T;
        N = 0.347343 - 0.00014709391 * T;
        G = 0.993126 + 0.00273777850 * T;

        L -= Int(L);
        M0 -= Int(M0);
        F -= Int(F);
        D -= Int(D);
        N -= Int(N);
        G -= Int(G);

        L *= P2;
        M0 *= P2;
        F *= P2;
        D *= P2;
        N *= P2;
        G *= P2;

        V = 0.39558 * Math.sin(F + N) + 0.08200 * Math.sin(F) + 0.03257 * Math.sin(M0 - F - N) + 0.01092 * Math.sin(M0 + F + N) + 0.00666 * Math.sin(M0 - F) - 0.00644 * Math.sin(M0 + F - 2 * D + N) - 0.00331 * Math.sin(F - 2 * D + N) - 0.00304 * Math.sin(F - 2 * D) - 0.00240 * Math.sin(M0 - F - 2 * D - N) + 0.00226 * Math.sin(M0 + F) - 0.00108 * Math.sin(M0 + F - 2 * D) - 0.00079 * Math.sin(F - N) + 0.00078 * Math.sin(F + 2 * D + N);
        U = 1 - 0.10828 * Math.cos(M0) - 0.01880 * Math.cos(M0 - 2 * D) - 0.01479 * Math.cos(2 * D) + 0.00181 * Math.cos(2 * M0 - 2 * D) - 0.00147 * Math.cos(2 * M0) - 0.00105 * Math.cos(2 * D - G) - 0.00075 * Math.cos(M0 - 2 * D + G);
        W = 0.10478 * Math.sin(M0) - 0.04105 * Math.sin(2 * F + 2 * N) - 0.02130 * Math.sin(M0 - 2 * D) - 0.01779 * Math.sin(2 * F + N) + 0.01774 * Math.sin(N) + 0.00987 * Math.sin(2 * D) - 0.00338 * Math.sin(M0 - 2 * F - 2 * N) - 0.00309 * Math.sin(G) - 0.00190 * Math.sin(2 * F) - 0.00144 * Math.sin(M0 + N) - 0.00144 * Math.sin(M0 - 2 * F - N) - 0.00113 * Math.sin(M0 + 2 * F + 2 * N) - 0.00094 * Math.sin(M0 - 2 * D + G) - 0.00092 * Math.sin(2 * M0 - 2 * D);
        S = W / Math.sqrt(U - V * V);
        A5 = L + Math.atan(S / Math.sqrt(1 - S * S));
        S = V / Math.sqrt(U);
        D5 = Math.atan(S / Math.sqrt(1 - S * S));
        R5 = 60.40974 * Math.sqrt(U);

        M[I][1] = A5;
        M[I][2] = D5;
        M[I][3] = R5;

        T = T + 0.5;
    }

    if (M[2][1] <= M[1][1]) M[2][1] += P2;
    if (M[3][1] <= M[2][1]) M[3][1] += P2;

    Z1 = R1 * (90.567 - 41.685 / M[2][3]);
    S = Math.sin(latitude * R1);
    C = Math.cos(latitude * R1);
    Z = Math.cos(Z1);
    M8 = 0;
    W8 = 0;
    A0 = M[1][1];
    D0 = M[1][2];

    rise = set = null;

    for (C0 = 0; C0 < 24; C0++)
    {
        P = (C0 + 1) / 24;
        F0 = M[1][1];
        F1 = M[2][1];
        F2 = M[3][1];
        A = F1 - F0;
        B = F2 - F1 - A;
        F = F0 + P * (2 * A + B * (2 * P - 1));
        A2 = F;
        F0 = M[1][2];
        F1 = M[2][2];
        F2 = M[3][2];
        A = F1 - F0;
        B = F2 - F1 - A;
        F = F0 + P * (2 * A + B * (2 * P - 1));
        D2 = F;

        L0 = T0 + C0 * K1;
        L2 = L0 + K1;
        if (A2 < A0) A2 = A2 + 2 * P1;
        H0 = L0 - A0;
        H2 = L2 - A2;
        H1 = (H2 + H0) / 2;
        D1 = (D2 + D0) / 2;
        if (C0 <= 0)
        {
            V0 = S * Math.sin(D0) + C * Math.cos(D0) * Math.cos(H0) - Z;
        }
        V2 = S * Math.sin(D2) + C * Math.cos(D2) * Math.cos(H2) - Z;
        if (Sign(V0) != Sign(V2))
        {
            V1 = S * Math.sin(D1) + C * Math.cos(D1) * Math.cos(H1) - Z;
            A = 2 * V2 - 4 * V1 + 2 * V0;
            B = 4 * V1 - 3 * V0 - V2;
            D = B * B - 4 * A * V0;
            if (D >= 0)
            {
                D = Math.sqrt(D);
                E = (-B + D) / (2 * A);
                if ((E > 1) || (E < 0)) E = (-B - D) / (2 * A);
                T3 = C0 + E + 1 / 120;
                H3 = Int(T3);
                M3 = Int((T3 - H3) * 60);

                time = H3 + (M3 / 60.0);
                if ((V0 < 0) && (V2 > 0)) rise = time;
                if ((V0 > 0) && (V2 < 0)) set = time;
            }
        }

        A0 = A2;
        D0 = D2;
        V0 = V2;
    }

    return moonrise ? rise : set;
}


// -- LocalizedStringForKey --
//
// Gets a localized string. If no string is found or an error occurs, returns
// the key.
//
// Parameters
//   key - key of string to fetch
//
// Returns
//   localized string, or key on failure
//
function LocalizedStringForKey(key)
{
    try
    {
        var ret = localizedStrings[key];
        if (ret === undefined) ret = key;
        return ret;
    }
    catch (ex)
    {
        // Do nothing.
    }

    return key;
}


// -- SetText --
//
// Replaces an object's children with a single text node.
//
// Parameters
//     id - ID of the target object
//   text - text to place in replacement text node
//
function SetText(id, text)
{
    var obj = document.getElementById(id);

    while (obj.firstChild)
        obj.removeChild(obj.firstChild);

    obj.appendChild(document.createTextNode(text));
}


// -- SetTextTitle --
//
// Replaces an object's title attribute
//
// Parameters
//     id - ID of the target object
//   text - text to place in the title attribute
//
function SetTextTitle(id, text)
{
    var obj = document.getElementById(id);

    obj.setAttribute('title', text);
}


// -- TimeString --
//
// Returns a string representation of a given time, formatted with the user's
// short time format in the location's time zone.
//
// Parameters
//   hours - time in milliseconds since 1970 GMT
//
// Returns
//   string representation of given time
//
function TimeString(hours)
{
    if (hours == null) return '';

    return window.TimeZoneHelper.formattedTimeForDate(hours);
}


// -- AdjustClockMidday --
//
// Adjusts all the properties so the midday related elements are set properly
// based on the current preferences
//
function AdjustClockMidday()
{
    var targetWidth;
    if (gClockOnly)
    {
        targetWidth = 149;
        document.getElementById('tableWrapper').style.display = 'none';
        document.getElementById('bandAid').style.width = '12px';
        document.getElementById('bandAid').style.height = '4px';
        document.getElementById('bandAid').style.display = 'block';
        document.getElementById('middayLine').style.display = 'none';
        document.getElementById('middayCell').style.display = 'none';
    }
    else if (gShowMidday)
    {
        targetWidth = gExpandedWidth;
        document.getElementById('tableWrapper').style.display = 'table';
        document.getElementById('middayCell').style.display = 'table-cell';
        document.getElementById('bandAid').style.width = String(gExpandedWidth - 137) + 'px';
        document.getElementById('bandAid').style.height = '4px';
        document.getElementById('bandAid').style.display = 'block';
        var leftSide = document.getElementById('tableWrapper').offsetLeft +
            Math.round((117 - document.getElementById('mainTable').offsetWidth) / 2);
        var width = document.getElementById('middayLabel').offsetWidth;
        document.getElementById('middayLine').style.left = String(leftSide) + 'px';
        document.getElementById('middayLine').style.width = String(width) + 'px';
        document.getElementById('middayLine').style.display = 'block';
    }
    else
    {
        targetWidth = gExpandedWidth;
        document.getElementById('tableWrapper').style.display = 'table';
        document.getElementById('bandAid').style.display = 'none';
        document.getElementById('middayLine').style.display = 'none';
        document.getElementById('middayCell').style.display = 'none';
    }
    if (window.innerWidth != targetWidth || window.innerHeight != gExpandedWidth)
    {
        if (!isBackSide())
            window.resizeTo(targetWidth, gFrontHeight);

        // Make sure width matches target.
        document.getElementById('bgCenter').style.width = String(targetWidth - 149) + 'px';
        document.getElementById('bgRight').style.left = String(targetWidth - 19) + 'px';
        document.getElementById('placeName').style.width = String(targetWidth - 48) + 'px';
    }
}


// -- WidgetDidShow --
//
// Handles the onshow event for the widget. Redraws and starts periodic updates.
//
var gShown = false;
var gMaxRetries = 50;
function WidgetDidShow()
{
    gShown = true;
    if (gClockTimeout) clearTimeout(gClockTimeout);

    // Make sure we're not running too early which can happen if there are a
    // lot of Widgets on the Dashboard and it's the initial load
    if (!gLoaded) {
        // Try again after a short delay provided we have not exhausted retries
        if (gMaxRetries) {
            --gMaxRetries;
            gClockTimeout = setTimeout('WidgetDidShow();', 200);
        }
        return;
    }

    Redraw();
    // The clock hand is 59 pixels long, this corresponds to a 1 pixel movement
    // at the end of the hand when it is rotated by an amount approximately
    // corresponding to 233 seconds.  We use half that just to be sure (in case
    // anti-aliasing is being used to draw the hand) which is just under two
    // minutes.
    gClockTimeout = setTimeout('WidgetDidShow();', 116000);
}


// -- WidgetDidHide --
//
// Handles the onhide event for the widget. Stops periodic updates.
//
function WidgetDidHide()
{
    if (gClockTimeout)
    {
        clearTimeout(gClockTimeout);
        gClockTimeout = false;
    }
}

// -- MillisToDrawRadians --
//
// Converts a UTC time in milliseconds since 1970 GMT first to a number of
// radians for drawing that represents the time in the local time of the
// selected location on the 24hr clock face.
// The hourOffset value is a floating point number of HOURS to adjust the time
// by before computing the radians (it's ADDED to the computed hours time)
// The result will be normalized to the range [0,2Pi).
//
function MillisToDrawRadians(millis, hourOffset)
{
  if (isNaN(millis) || !isFinite(millis) || isNull(millis)) return millis;
  var utc = new Date(millis + window.TimeZoneHelper.timeOffsetMillisForDate(millis));
  var hours = utc.getUTCHours() + (utc.getUTCMinutes() / 60.0) + (utc.getUTCSeconds() / 3600.0);
  hours += hourOffset;
  while (hours >= 24.0) hours -= 24.0;
  while (hours <   0.0) hours += 24.0;
  return (hours / 24.0) * 6.28318530717959;
}

// -- Redraw --
//
// Recalculates times and redraws the widget.
//
function Redraw()
{
    // Calculate sunrise, sunset, dawn, and dusk.

    var nowDate = new Date();
    var nowMillis = nowDate.getTime();
    nowMillis += window.TimeZoneHelper.timeOffsetMillisForDate(nowMillis);

    var sunrise = CalculateSunriseOrSunset(gLatitude, gLongitude, nowMillis, true, false);
    var sunset  = CalculateSunriseOrSunset(gLatitude, gLongitude, nowMillis, false, false);
    var morningTwilight = CalculateSunriseOrSunset(gLatitude, gLongitude, nowMillis, true, true);
    var eveningTwilight = CalculateSunriseOrSunset(gLatitude, gLongitude, nowMillis, false, true);
    var midday;
//  var moonrise = CalculateMoonriseOrMoonset(gLatitude, gLongitude, nowMillis, true);
//  var moonset = CalculateMoonriseOrMoonset(gLatitude, gLongitude, nowMillis, false);

    var sunAlwaysUp   = ((isNaN(sunrise) || !isFinite(sunrise)) && isNull(sunset));
    var sunAlwaysDown = ((isNaN(sunset) || !isFinite(sunset)) && isNull(sunrise));

    if (!sunAlwaysUp && !sunAlwaysDown)
    {
        midday = (sunrise + sunset) / 2;
    }
    else if (morningTwilight && eveningTwilight)
    {
        midday = (morningTwilight + eveningTwilight) / 2;
    }
    else {
        midday = null;
    }

    // Update digital displays.

    if (sunAlwaysUp || sunAlwaysDown)
    {
        SetText('sunriseCell', '—');
        SetText('sunsetCell', '—');
    }
    else
    {
        SetText('sunriseCell', TimeString(sunrise));
        SetText('sunsetCell', TimeString(sunset));
    }

    if (morningTwilight && eveningTwilight)
    {
        SetText('morningTwilightCell', TimeString(morningTwilight));
        SetText('eveningTwilightCell', TimeString(eveningTwilight));
    }
    else
    {
        SetText('morningTwilightCell', '—');
        SetText('eveningTwilightCell', '—');
    }
    if (midday)
    {
        SetText('middayCell', TimeString(midday));
    }
    else
    {
        SetText('middayCell', '—');
    }
    AdjustClockMidday();

    // Convert times to radians for drawing analog clock.

    var morningTwilightRadians = MillisToDrawRadians(morningTwilight, 6.0);
    var sunriseRadians         = MillisToDrawRadians(sunrise, 6.0);
    var sunsetRadians          = MillisToDrawRadians(sunset, 6.0);
    var eveningTwilightRadians = MillisToDrawRadians(eveningTwilight, 6.0);
    var middayRadians          = MillisToDrawRadians(midday, 6.0);
//  var moonriseRadians        = MillisToDrawRadians(moonrise, 6.0);
//  var moonsetRadians         = MillisToDrawRadians(moonset, 6.0);


    // Prepare canvas.

    var canvas = document.getElementById('clock');
    var context = canvas.getContext('2d');

    context.clearRect(0, 0, 100, 100);

    context.save();
    context.translate(50, 50);


    // Draw clock.

    if (sunAlwaysUp)
    {
        if (eveningTwilight && morningTwilight)
        {
            // Draw twilight segment with slight overlap.

            context.beginPath();
            context.moveTo(0, 0);
            context.arc(0, 0, 50, morningTwilightRadians - 0.05, eveningTwilightRadians + 0.05, false);
            context.fillStyle = '#3875D7';
            context.fill();

            // Draw daytime segment.

            context.beginPath();
            context.moveTo(0, 0);
            context.arc(0, 0, 50, eveningTwilightRadians, morningTwilightRadians, false);
            context.fillStyle = '#CDDCF3';
            context.fill();
        }
        else
        {
            // Draw daytime circle.

            context.beginPath();
            context.moveTo(0, 0);
            context.arc(0, 0, 50, 0, -1, false);
            context.arc(0, 0, 50, -1, 0.1, false);
            context.fillStyle = '#CDDCF3';
            context.fill();
        }
    }
    else if (sunAlwaysDown)
    {
        if (eveningTwilight && morningTwilight)
        {
            // Draw twilight segment with slight overlap.

            context.beginPath();
            context.moveTo(0, 0);
            context.arc(0, 0, 50, morningTwilightRadians - 0.05, eveningTwilightRadians + 0.05, false);
            context.fillStyle = '#3875D7';
            context.fill();

            // Draw nighttime segment.

            context.beginPath();
            context.moveTo(0, 0);
            context.arc(0, 0, 50, eveningTwilightRadians, morningTwilightRadians, false);
            context.fillStyle = '#002F80';
            context.fill();
        }
        else
        {
            // Draw nighttime circle.

            context.beginPath();
            context.moveTo(0, 0);
            context.arc(0, 0, 50, 0, -1, false);
            context.arc(0, 0, 50, -1, 0.1, false);
            context.fillStyle = '#002F80';
            context.fill();
        }
    }
    else
    {
        // Draw dusk segment with slight overlap.

        context.beginPath();
        context.moveTo(0, 0);
        context.arc(0, 0, 50, sunsetRadians - 0.05, eveningTwilightRadians + 0.05, false);
        context.fillStyle = '#3875D7';
        context.fill();


        // Draw dawn segment with slight overlap.

        context.beginPath();
        context.moveTo(0, 0);
        context.arc(0, 0, 50, morningTwilightRadians - 0.05, sunriseRadians + 0.05, false);
        context.fillStyle = '#3875D7';
        context.fill();


        // Draw daytime segment.

        context.beginPath();
        context.moveTo(0, 0);
        context.arc(0, 0, 50, sunriseRadians, sunsetRadians, false);
        context.fillStyle = '#CDDCF3';
        context.fill();


        // Draw nighttime segment.

        context.beginPath();
        context.moveTo(0, 0);
        context.arc(0, 0, 50, eveningTwilightRadians, morningTwilightRadians, false);
        context.fillStyle = '#002F80';
        context.fill();
    }
    if (gShowMidday && middayRadians)
    {
        // Draw midday line
        context.beginPath();
        context.moveTo(0, 0);
        context.arc(0, 0, 50, middayRadians - 0.01, middayRadians + 0.01, false);
        context.fillStyle = '#E10000';
        context.fill();
    }


    // Draw moon arc.

/*  var moonArcThickness = 6;

    var moonDoesRise = (moonriseRadians != null);
    var moonDoesSet  = (moonsetRadians  != null);

    if (! moonDoesRise) moonriseRadians = moonsetRadians + 0.075;
    if (! moonDoesSet)  moonsetRadians  = moonriseRadians - 0.075;

    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, 40, moonriseRadians, moonsetRadians, false);

    var endPointX = (40 - moonArcThickness / 2.0) * Math.cos(moonsetRadians);
    var endPointY = (40 - moonArcThickness / 2.0) * Math.sin(moonsetRadians);
    context.arc(endPointX, endPointY, moonArcThickness / 2.0, moonsetRadians, moonsetRadians + 3.14159, ! moonDoesSet);

    context.arc(0, 0, 40 - moonArcThickness, moonsetRadians, moonriseRadians, true);

    endPointX = (40 - moonArcThickness / 2.0) * Math.cos(moonriseRadians);
    endPointY = (40 - moonArcThickness / 2.0) * Math.sin(moonriseRadians);
    context.arc(endPointX, endPointY, moonArcThickness / 2.0, moonriseRadians + 3.14159, moonriseRadians, ! moonDoesRise);

    context.closePath();
    context.fillStyle = '#FFFFFF';
    context.fill();*/


    // Convert current time to radians.

    var nowRadians = MillisToDrawRadians(nowDate.getTime(), 12.0);


    // Draw clock hand.

    context.lineCap = 'round';
    context.save();
    context.translate(0, 2);
    context.rotate(nowRadians);
    context.drawImage(gClockHandShadow, -11.5, -48);
    context.restore();
    context.save();
    context.rotate(nowRadians);
    context.drawImage(gClockHand, -11.5, -48);
    context.restore();


    // Clean up.

    context.restore();
}


// -- WidgetWillRemove --
//
// Handles the onremove event for the widget. Deletes preferences.
//
function WidgetWillRemove()
{
    widget.setPreferenceForKey(null, widget.identifier + '-clockOnly');
    widget.setPreferenceForKey(null, widget.identifier + '-latitude');
    widget.setPreferenceForKey(null, widget.identifier + '-longitude');
    widget.setPreferenceForKey(null, widget.identifier + '-name');
    widget.setPreferenceForKey(null, widget.identifier + '-state');
    widget.setPreferenceForKey(null, widget.identifier + '-country');
    widget.setPreferenceForKey(null, widget.identifier + '-countryCode');
    widget.setPreferenceForKey(null, widget.identifier + '-selectedName');
    widget.setPreferenceForKey(null, widget.identifier + '-selectedRegion');
    widget.setPreferenceForKey(null, widget.identifier + '-selectedState');
    widget.setPreferenceForKey(null, widget.identifier + '-timeZone');
    widget.setPreferenceForKey(null, widget.identifier + '-twilightZenith');
    widget.setPreferenceForKey(null, widget.identifier + '-showMidday');
}


// -- CityRequestHandler --
//
// Handles state changes for the XML request object.
//
function CityRequestHandler()
{
    if (gCityRequest.readyState != 4 || gCityRequest.status != 200) return;

    var results = gCityRequest.responseXML.getElementsByTagName('r');
    if (results.length == 0) return;

    gPlaceName = results[0].getElementsByTagName('n')[0].firstChild.nodeValue;
    gLatitude  = results[0].getElementsByTagName('a')[0].firstChild.nodeValue;
    gLongitude = results[0].getElementsByTagName('o')[0].firstChild.nodeValue;
    var timeZone = results[0].getElementsByTagName('t')[0].firstChild.nodeValue;

    window.TimeZoneHelper.setTimeZoneWithName(timeZone);

    gStateName   = gLookupStateName;
    gCountryName = gLookupCountryName;
    gCountryCode = gLookupCountryCode;

    widget.setPreferenceForKey(gPlaceName,   widget.identifier + '-name');
    widget.setPreferenceForKey(gPlaceName,   widget.identifier + '-selectedName');
    widget.setPreferenceForKey(gStateName,   widget.identifier + '-state');
    widget.setPreferenceForKey(gCountryName, widget.identifier + '-country');
    widget.setPreferenceForKey(gCountryCode, widget.identifier + '-countryCode');
    widget.setPreferenceForKey(gLatitude,    widget.identifier + '-latitude');
    widget.setPreferenceForKey(gLongitude,   widget.identifier + '-longitude');
    widget.setPreferenceForKey(timeZone,     widget.identifier + '-timeZone');

    document.getElementById('city').value = gPlaceName;
    SetText('placeName', gPlaceName);

    Redraw();
}


// -- SaveSettings --
//
// Saves settings for possible ESCape
//
function SaveSettings()
{
    gSavedSettings.country  = document.getElementById('country').value;
    gSavedSettings.countryIndex  = document.getElementById('country').selectedIndex;
    gSavedSettings.state    = document.getElementById('state').value;
    gSavedSettings.city     = document.getElementById('city').value;
    gSavedSettings.twilight = document.getElementById('twilight').value;
    gSavedSettings.midday   = document.getElementById('midday').checked;
}


// -- RestoreSettings --
//
// Restores settings after ESCape
//
function RestoreSettings()
{
    document.getElementById('country').value  = gSavedSettings.country;
    CountryDidChange();
    document.getElementById('state').value    = gSavedSettings.state;
    document.getElementById('city').value     = gSavedSettings.city;
    document.getElementById('twilight').value = gSavedSettings.twilight;
    document.getElementById('midday').checked = gSavedSettings.midday;
    TwilightDidChange();
    MiddayDidChange();
}


// -- FlipToBack --
//
// Action for info button. Flips to back.
//
function FlipToBack()
{
    var front = document.getElementById("front");
    var back  = document.getElementById("back");

    if (gClockOnly) {
        document.getElementById('infoButton').style.display = 'none';
        window.resizeTo(gExpandedWidth, gFrontHeight);
    }

    widget.prepareForTransition("ToBack");

    front.style.display = "none";
    back.style.display = "block";

    window.resizeTo(gExpandedWidth + gBackSizeAdjust, gBackHeight);

    SaveSettings();
    setTimeout("widget.performTransition(); document.getElementById('infoButton').style.display = 'block';", 0);
}


// -- PerformLookupWith
//
// Make the actual lookup request and remember the lookup values
//
function PerformLookupWith(name, state, countryName, countryCode, executeNow)
{
    gLookupName        = name;
    gLookupStateName   = state;
    gLookupCountryName = countryName;
    gLookupCountryCode = countryCode;

    var regionCode = countryCode;
    if (countryCode == 'US') regionCode += '/' + state;

    // Start location lookup.
/*
    var re = /\//;
    var urlRegion = regionCode.replace(re, '%2f');

    var url = 'http://captaindan.org/services/solplaces/?v=' + gVersion + '&r=' + urlRegion + '&n=' + name;

    if (gCityRequest) gCityRequest.abort();
    gCityRequest = new XMLHttpRequest();
    gCityRequest.onreadystatechange = CityRequestHandler;
    gCityRequest.open('GET', url, true);
    gCityRequest.send('');
*/
    var response = window.TimeZoneHelper.lookupPlaceInRegionWithName(regionCode, name);
    gCityRequest = {};
    gCityRequest.readyState = 4;
    gCityRequest.status = 200;
    gCityRequest.responseXML = (new DOMParser()).parseFromString(response, 'text/xml');
    if (gCityRequest.responseXML)
    {
        if (executeNow)
        {
            CityRequestHandler();
            SaveSettings();
        }
        else
        {
            setTimeout("CityRequestHandler(); SaveSettings();", 0);
        }
    }
}


// -- PerformLookup --
//
// Perform a city lookup now and save the settings
//
function PerformLookup(executeNow)
{
    // Save preferences.

    var countryMenu = document.getElementById('country');
    var country = countryMenu.options[countryMenu.selectedIndex].value;
    widget.setPreferenceForKey(country, widget.identifier + '-selectedRegion');

    if (country == 'US')
    {
        var state = document.getElementById('state').options[document.getElementById('state').selectedIndex].value
        widget.setPreferenceForKey(state, widget.identifier + '-selectedState');
    }

    var name = document.getElementById('city').value;
    widget.setPreferenceForKey(name, widget.identifier + '-selectedName');

    var twilightZenith = document.getElementById('twilight').value;
    widget.setPreferenceForKey(twilightZenith, widget.identifier + '-twilightZenith');


    if (gSavedSettings.country != document.getElementById('country').value
        || gSavedSettings.state != document.getElementById('state').value
        || gSavedSettings.city != document.getElementById('city').value)
    {
        var countryName = countryMenu.options[countryMenu.selectedIndex].text;
        state = document.getElementById('state').value;
        PerformLookupWith(name, state, countryName, country, executeNow);
    }
}


// -- FlipToFront --
//
// Action for done button. Saves preferences, flips to front, and calls onshow
// handler (WidgetDidShow).
//
function FlipToFront(discardChanges)
{
    if (!discardChanges) PerformLookup();

    // Flip over.

    var front = document.getElementById("front");
    var back  = document.getElementById("back");

    widget.prepareForTransition("ToFront");

    back.style.display = "none";
    front.style.display = "block";

    if (gClockOnly)
        window.resizeTo(149, gFrontHeight);
    else
        window.resizeTo(gExpandedWidth, gFrontHeight);

    setTimeout("widget.performTransition(); WidgetDidShow();", 0);
}


// -- ToggleClockOnly --
//
// Toggles the size of the widget to display only the clock or the entire
// widget.
//
function ToggleClockOnly()
{
    // Toggle preference.

    gClockOnly = !gClockOnly;
    widget.setPreferenceForKey(gClockOnly, widget.identifier + '-clockOnly');


    // Hide info button, otherwise it gets flickery.

    document.getElementById('infoButton').style.display = 'none';


    // Determine target width and increment, and hide some elements.

    if (gClockOnly)
    {
        document.getElementById('tableWrapper').style.display = 'none';
        document.getElementById('bandAid').style.width = '12px';
        document.getElementById('middayLine').style.display = 'none';
        var target = 149;
        var increment = -15;
    }
    else
    {
        document.getElementById('bandAid').style.display = 'none';
        target = gExpandedWidth;
        increment = 15;
    }


    // Animate size change.

    for (width = window.innerWidth; increment < 0 ? (width > target) : (width < target); width += increment)
    {
        window.resizeBy(increment, 0);
        document.getElementById('bgCenter').style.width = String(width - 149) + 'px';
        document.getElementById('bgRight').style.left = String(width - 19) + 'px';
        document.getElementById('placeName').style.width = String(width - 48) + 'px';
    }


    // Update widget width and show and hide some elements.

    AdjustClockMidday();
    document.getElementById('infoButton').style.display = 'block';
    TwilightDidChange();
}


// We must set these here or else we can miss the onshow event when
// the widget is initially loaded (it can be delivered before WidgetDidLoad
// finishes running in some peculiar cases)
if (window.widget) {
    // Install event handlers.

    widget.onshow   = WidgetDidShow;
    widget.onhide   = WidgetDidHide;
    widget.onremove = WidgetWillRemove;
}


// -- WidgetForceShow --
//
// Checks to make sure a WidgetDidShow event has actually taken place.
// If not one will be forced now.
//
function WidgetForceShow()
{
    if (!gShown && !gClockTimeout)
    {
        // Somehow the initial WidgetDidShow was missed
        gClockTimeout = setTimeout('WidgetDidShow();', 10);
    }
}


// -- WidgetDidLoad --
//
// Handles onload event for the widget. Initializes interface elements,
// creating buttons and installing localized strings. Loads or creates
// preferences. Sets up widget event handlers.
//
var gLoaded = false;
function WidgetDidLoad()
{
    // Do any locale-specific initialization that might need to be performed.
    // (In particular, the German and Dutch localizations need to widen the window.)

    gFrontSizeAdjust = 0;
    gBackSizeAdjust = 0;
    if (window.LocaleInit) LocaleInit();
    gExpandedWidth = 272 + gFrontSizeAdjust;


    // Create buttons for flipping.

    gDoneButton      = new AppleGlassButton(
                                document.getElementById("doneButton"),
                                LocalizedStringForKey("Done"),
                                function (){FlipToFront();});

    gWhiteInfoButton = new AppleInfoButton(
                                document.getElementById("infoButton"),
                                document.getElementById("front"),
                                "white",
                                "white",
                                function (){FlipToBack();});


    // Insert localized strings into HTML.

    SetText('dawnLabel',          LocalizedStringForKey('Dawn'));
    SetText('sunriseLabel',       LocalizedStringForKey('Sunrise'));
    SetText('sunsetLabel',        LocalizedStringForKey('Sunset'));
    SetText('duskLabel',          LocalizedStringForKey('Dusk'));
    SetText('countryLabel',       LocalizedStringForKey('Country:'));
    SetText('stateLabel',         LocalizedStringForKey('State:'));
    SetText('cityLabel',          LocalizedStringForKey('City:'));
    //SetText('byLabel',          LocalizedStringForKey('by'));
    SetText('aboutLabel',         LocalizedStringForKey('About'));

    SetText('twilightLabel',      LocalizedStringForKey('Twilight:'));
    SetText('civilOption',        LocalizedStringForKey('Civil'));
    SetText('nauticalOption',     LocalizedStringForKey('Nautical'));
    SetText('astronomicalOption', LocalizedStringForKey('Astronomical'));

    SetTextTitle('mapIcon',       LocalizedStringForKey('Show location on map'));

    // Collapse if necessary.

    gClockOnly = widget.preferenceForKey(widget.identifier + '-clockOnly');
    gShowMidday = widget.preferenceForKey(widget.identifier + '-showMidday');
    document.getElementById('midday').checked = gShowMidday ? true : false;
    AdjustClockMidday();


    // Get location and time zone from preferences, or set to default.

    gPlaceName = widget.preferenceForKey(widget.identifier + '-name');
    var myCity = null;
    var myRegion = null;
    var myState = null;

    if (gPlaceName)
    {
        gLatitude    = widget.preferenceForKey(widget.identifier + '-latitude');
        gLongitude   = widget.preferenceForKey(widget.identifier + '-longitude');
        gStateName   = widget.preferenceForKey(widget.identifier + '-state');
        gCountryName = widget.preferenceForKey(widget.identifier + '-country');
        gCountryCode = widget.preferenceForKey(widget.identifier + '-countryCode');
        window.TimeZoneHelper.setTimeZoneWithName(widget.preferenceForKey(widget.identifier + '-timeZone'));

        // Use alternate values for older versions

        if (!gStateName)
            gStateName   = widget.preferenceForKey(widget.identifier + '-selectedState');
        if (!gCountryCode)
            gCountryCode = widget.preferenceForKey(widget.identifier + '-selectedRegion');
        if (!gCountryName && gCountryCode)
        {
            var countryMenu = document.getElementById('country');
            countryMenu.value = gCountryCode;
            gCountryName = countryMenu.options[countryMenu.selectedIndex].text;
        }
    }
    else
    {
        gPlaceName   = 'Cupertino';
        gLatitude    =   37.32306;
        gLongitude   = -122.03111;
        gStateName   = 'CA';
        gCountryName = 'United States';
        gCountryCode = 'US';
        window.TimeZoneHelper.setTimeZoneWithName('US/Pacific');

        myCity   = window.TimeZoneHelper.myCityName();
        myRegion = window.TimeZoneHelper.myRegionCode();
    }

    SetText('placeName', gPlaceName);

    if (myCity && myRegion)
    {
        if (myRegion.slice(0, 2) == 'US')
        {
            myState = myRegion.slice(3);
            myRegion = 'US';
        }

        var countryMenu = document.getElementById('country');
        countryMenu.value = myRegion;
        CountryDidChange();
        if (myState) document.getElementById('state').value = myState;
        document.getElementById('city').value = myCity;
        var regionName = countryMenu.options[countryMenu.selectedIndex].text;
        PerformLookupWith(myCity, myState, regionName, myRegion);
    }


    // Set displayed preferences.

    var selectedRegion = widget.preferenceForKey(widget.identifier + '-selectedRegion');
    var selectedState  = widget.preferenceForKey(widget.identifier + '-selectedState');
    var selectedCity   = widget.preferenceForKey(widget.identifier + '-selectedName');
    var twilightZenith = widget.preferenceForKey(widget.identifier + '-twilightZenith');

    if (selectedRegion)
    {
        document.getElementById('country').value  = selectedRegion;
        CountryDidChange();
    }

    if (selectedState)  document.getElementById('state').value    = selectedState;
    if (selectedCity)   document.getElementById('city').value     = selectedCity;

    if (twilightZenith)
    {
        document.getElementById('twilight').value = twilightZenith;
        TwilightDidChange();
    }

    // If WidgetDidShow gets called too soon, it will retry until gLoaded
    // becomes true
    gLoaded = true;

    // Make sure we don't miss the initial onshow event (it can sometimes
    // get dropped when there are a lot of widgets during initial load) and
    // may never be sent when a widget is forcibly reloaded with Cmd-R
    setTimeout('WidgetForceShow();', 500);
}

// -- aboutURL --
//
// Computes the correct file: URL to access the About.html page
//
function aboutURL()
{
    var base = location.pathname.replace(/\/[^\/]*$/,'');
    return location.protocol + '//' + location.host + base + '/About.html';
}


// -- getLocationName --
//
// Returns a string describing the currently selected location
//
function getLocationName()
{
    if (!gCountryCode || !gCountryName || !gPlaceName) return null;
    if (gCountryCode == 'US' && !gStateName) return null;
    if (gCountryCode == 'US')
    {
        return gPlaceName + ', ' + gStateName;
    }
    else
    {
        return gPlaceName + ', ' + gCountryName;
    }
}


// -- encodeMapQuery --
//
// Converts a string into a map query URL-friendly version
//
function encodeMapQuery(text)
{
    var strings = text.split(' ');
    var results = new Array;
    for (var i = 0; i < strings.length; ++i)
    {
        results.push(encodeURIComponent(strings[i]));
    }
    return results.join('+');
}


// -- mapURL --
//
// Computes the URL to open the map in an external browser
//
function mapURL()
{
    var locName = getLocationName();
    if (!locName) return null;
    return 'http://maps.google.com/maps?q='
        + gLatitude + ',' + gLongitude
        + '+(' + encodeMapQuery(locName) + ')'
        + '&z=13&iwloc=A';
}


// -- cityKeyPress --
//
// Handles return, enter and escape for the city field
//
function cityKeyPress(evt)
{
    var keyCode = evt.keyCode;
    if ((keyCode == 13 || keyCode == 3 || keyCode == 27)
        && isBackSide())
    {
      evt.stopPropagation();
      evt.preventDefault();
      if (keyCode == 13 || keyCode == 3)
      {
          /* The return or enter key was pressed */
          setTimeout('FlipToFront();', 0);
          return false;
      }
      else if (keyCode == 27)
      {
          /* The escape key was pressed */
          RestoreSettings();
          setTimeout('FlipToFront(true)', 0);
          return false;
      }
    }
    return true;
}


// -- bodyKeyPress --
//
// Handles same keys for the whole back and front sides
//
function bodyKeyPress(evt)
{
    var keyCode = evt.keyCode;
    if (keyCode == 13 || keyCode == 3 || keyCode == 27)
    {
      if (isBackSide())
          return cityKeyPress(evt);
      evt.stopPropagation();
      evt.preventDefault();
      setTimeout('FlipToBack();', 0);
      return false;
    }
    return true;
}
