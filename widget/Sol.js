//
//  Sol.js
//  Logic for Sol
//
//  Copyright (C) 2006 Daniel S. Neumeyer
//  Portions Copyright (C) 2010 Kyle J. McKay
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

var gVersion = '1.3.2';


// Location and GMT offset of selected location.

var gLatitude;
var gLongitude;
var gTimeOffset;


// Buttons... not actually used after instantiation.

var gDoneButton;
var gWhiteInfoButton;


// Whether only the clock is showing, and the widget's original width.

var gClockOnly;
var gExpandedWidth;


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
//        date - Date object representing day to calculate
//     sunrise - Boolean value indicating whether to calculate sunrise (true) or sunset (false)
//    twilight - Boolean value indicating whether to calculate twilight (true) or sunrise/sunset (false)
//
// Returns
//   floating-point hour of sun event in UTC (e.g., 5.15 => 0509Z), or null if the event doesn't occur on the given day
//
function CalculateSunriseOrSunset(latitude, longitude, date, sunrise, twilight)
{
    // Source:
    //   Almanac for Computers, 1990
    //   published by Nautical Almanac Office
    //   United States Naval Observatory
    //   Washington, DC 20392

    day   = date.getDate();
    month = date.getMonth() + 1;
    year  = date.getFullYear();
    
    var zenith;
    
    if (twilight)
    {
        twilightSelect = document.getElementById('twilight');
        zenith = twilightSelect.value;
    }
    else
        zenith = 90.8333333333;
    
    
    // Calculate the day of the year.
    
    N1 = Math.floor(275.0 * month / 9.0);
    N2 = Math.floor((month + 9.0) / 12.0);
    N3 = 1.0 + Math.floor((year - 4.0 * Math.floor(year / 4.0) + 2.0) / 3.0);
    N = N1 - (N2 * N3) + day - 30.0;
    
    
    // Convert the longitude to hour value and calculate an approximate time.
    
    lngHour = longitude / 15.0;
    
    if (sunrise)
        t = N + ((6.0 - lngHour) / 24.0);
    else
        t = N + ((18.0 - lngHour) / 24.0)
    
    
    // Calculate the sun's mean anomaly.
    
    M = (0.9856 * t) - 3.289;
    
    
    // Calculate the sun's true longitude.
    
    L = M + (1.916 * sinD(M)) + (0.020 * sinD(2 * M)) + 282.634;
    
    while (L >= 360) L -= 360.0;
    while (L <  0)   L += 360.0;
    
    
    // Caculate the sun's right ascension.
    
    RA = atanD(0.91764 * tanD(L));
    
    while (RA >= 360) RA -= 360.0;
    while (RA <  0)   RA += 360.0;
    
    
    // Right ascension value needs to be in the same quadrant as L.
    
    Lquadrant = Math.floor(L / 90.0) * 90.0;
    RAquadrant = Math.floor(RA / 90.0) * 90.0;
    RA = RA + (Lquadrant - RAquadrant);
    
    
    // Right ascension value needs to be converted into hours.
    
    RA /= 15.0;
    
    
    // Calculate the sun's declination.
    
    sinDec = 0.39782 * sinD(L);
    cosDec = cosD(asinD(sinDec));
    
    
    // Calculate the sun's local hour angle.
    
    cosH = (cosD(zenith) - (sinDec * sinD(latitude))) / (cosDec * cosD(latitude));
    
    if (sunrise)
    {
        if (cosH > 1) return null;
    }
    else
    {
        if (cosH < -1) return null;
    }
        
    
    // Finish calculating H and convert into hours.
    
    if (sunrise)
        H = 360.0 - acosD(cosH);
    else
        H = acosD(cosH);
    
    H /= 15.0
    
    
    // Calculate local mean time of rising.
    
    T = H + RA - (0.06571 * t) - 6.622;
    
    
    // Adjust back to UTC.
    
    UT = T - lngHour;
    
    while (UT >= 24) UT -= 24.0;
    while (UT <  0)  UT += 24.0;
    
    
    return UT;
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
    obj = document.getElementById(id);
    
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
    obj = document.getElementById(id);

    obj.setAttribute('title', text);
}


// -- TimeString --
//
// Returns a string representation of a given time, formatted with the user's
// short time format.
//
// Parameters
//   hours - time in hours (floating point)
//
// Returns
//   string representation of given time
//
function TimeString(hours)
{
    if (hours == null) return '';
    
    if (window.TimeZoneHelper)
        return window.TimeZoneHelper.formattedTimeForHours(hours);
    else
    {
        hours += gTimeOffset;
        
        wholeHours = Math.floor(hours);
        minutes = Math.round((hours - Math.floor(hours)) * 60.0);
        
        return String(wholeHours > 12 ? wholeHours - 12 : wholeHours)
            + ':'
            + ((minutes < 10) ? '0' : '')
            + String(minutes)
            + ' '
            + (wholeHours > 11 ? 'PM' : 'AM');
    }
}


// -- WidgetDidShow --
//
// Handles the onshow event for the widget. Redraws and starts periodic updates.
//
function WidgetDidShow()
{
    if (gClockTimeout) clearTimeout(gClockTimeout);
    Redraw();
    gClockTimeout = setTimeout('WidgetDidShow();', 300000);
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


// -- Redraw --
//
// Recalculates times and redraws the widget.
//
function Redraw()
{
    // Calculate sunrise, sunset, dawn, and dusk.
    
    sunrise = CalculateSunriseOrSunset(gLatitude, gLongitude, new Date(), true, false);
    sunset  = CalculateSunriseOrSunset(gLatitude, gLongitude, new Date(), false, false);
    morningTwilight = CalculateSunriseOrSunset(gLatitude, gLongitude, new Date(), true, true);
    eveningTwilight = CalculateSunriseOrSunset(gLatitude, gLongitude, new Date(), false, true);
//  moonrise = CalculateMoonriseOrMoonset(gLatitude, gLongitude, new Date(), true);
//  moonset = CalculateMoonriseOrMoonset(gLatitude, gLongitude, new Date(), false);

    sunAlwaysUp   = (isNaN(sunrise) && isNull(sunset));
    sunAlwaysDown = (isNaN(sunset) && isNull(sunrise));
    
    
    // Update digital displays.
    
    if (sunAlwaysUp || sunAlwaysDown)
    {
        SetText('sunriseCell', '—');
        SetText('sunsetCell', '—');
        
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
    }
    else
    {
        SetText('morningTwilightCell', TimeString(morningTwilight));
        SetText('sunriseCell',         TimeString(sunrise));
        SetText('sunsetCell',          TimeString(sunset));
        SetText('eveningTwilightCell', TimeString(eveningTwilight));
    }
    
    
    // Convert times to radians for drawing analog clock.
    
    morningTwilightRadians = (morningTwilight + 6.0 + gTimeOffset) / 24.0 * 6.28318530717959;
    sunriseRadians         = (sunrise + 6.0 + gTimeOffset)         / 24.0 * 6.28318530717959;
    sunsetRadians          = (sunset + 6.0 + gTimeOffset)          / 24.0 * 6.28318530717959;
    eveningTwilightRadians = (eveningTwilight + 6.0 + gTimeOffset) / 24.0 * 6.28318530717959;
//  moonriseRadians        = (moonrise + 6.0 + gTimeOffset)        / 24.0 * 6.28318530717959;
//  moonsetRadians         = (moonset + 6.0 + gTimeOffset)         / 24.0 * 6.28318530717959;
    
    
    // Prepare canvas.
    
    canvas = document.getElementById('clock');
    context = canvas.getContext('2d');
    
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
    
    
    // Draw moon arc.
    
/*  moonArcThickness = 6;
    
    moonDoesRise = (moonriseRadians != null);
    moonDoesSet  = (moonsetRadians  != null);
    
    if (! moonDoesRise) moonriseRadians = moonsetRadians + 0.075;
    if (! moonDoesSet)  moonsetRadians  = moonriseRadians - 0.075;
    
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, 40, moonriseRadians, moonsetRadians, false);
    
    endPointX = (40 - moonArcThickness / 2.0) * Math.cos(moonsetRadians);
    endPointY = (40 - moonArcThickness / 2.0) * Math.sin(moonsetRadians);
    context.arc(endPointX, endPointY, moonArcThickness / 2.0, moonsetRadians, moonsetRadians + 3.14159, ! moonDoesSet);
    
    context.arc(0, 0, 40 - moonArcThickness, moonsetRadians, moonriseRadians, true);
    
    endPointX = (40 - moonArcThickness / 2.0) * Math.cos(moonriseRadians);
    endPointY = (40 - moonArcThickness / 2.0) * Math.sin(moonriseRadians);
    context.arc(endPointX, endPointY, moonArcThickness / 2.0, moonriseRadians + 3.14159, moonriseRadians, ! moonDoesRise);
    
    context.closePath();
    context.fillStyle = '#FFFFFF';
    context.fill();*/


    // Convert current time to radians.
    
    nowDate = new Date();
    nowDate = new Date(nowDate - -nowDate.getTimezoneOffset() * 60000);
    now = nowDate.getHours() + (nowDate.getMinutes() / 60.0);
    now += gTimeOffset;
    nowRadians = ((now + 12.0) / 24.0) * 6.28318530717959;
    
    
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
    widget.setPreferenceForKey(null, widget.identifier + '-selectedName');
    widget.setPreferenceForKey(null, widget.identifier + '-selectedRegion');
    widget.setPreferenceForKey(null, widget.identifier + '-selectedState');
    widget.setPreferenceForKey(null, widget.identifier + '-timeZone');
    widget.setPreferenceForKey(null, widget.identifier + '-twilightZenith');
}


// -- CityRequestHandler --
//
// Handles state changes for the XML request object.
//
function CityRequestHandler()
{
    if (gCityRequest.readyState != 4 || gCityRequest.status != 200) return;
    
    results = gCityRequest.responseXML.getElementsByTagName('r');
    if (results.length == 0) return;
    
    name       = results[0].getElementsByTagName('n')[0].firstChild.nodeValue;
    gLatitude  = results[0].getElementsByTagName('a')[0].firstChild.nodeValue;
    gLongitude = results[0].getElementsByTagName('o')[0].firstChild.nodeValue;
    timeZone   = results[0].getElementsByTagName('t')[0].firstChild.nodeValue;
    
    window.TimeZoneHelper.setTimeZoneWithName(timeZone);
    gTimeOffset = window.TimeZoneHelper.timeOffsetHours();
    
    widget.setPreferenceForKey(name,       widget.identifier + '-name');
    widget.setPreferenceForKey(name,       widget.identifier + '-selectedName');
    widget.setPreferenceForKey(gLatitude,  widget.identifier + '-latitude');
    widget.setPreferenceForKey(gLongitude, widget.identifier + '-longitude');
    widget.setPreferenceForKey(timeZone,   widget.identifier + '-timeZone');
    
    document.getElementById('city').value = name;
    
    SetText('placeName', name);
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
    TwilightDidChange();
}


// -- FlipToBack --
//
// Action for info button. Flips to back.
//
function FlipToBack()
{
    front = document.getElementById("front");
    back  = document.getElementById("back");
    
    if (gClockOnly)
    {
        document.getElementById('infoButton').style.display = 'none';
        window.resizeTo(gExpandedWidth, window.innerHeight);
    }

    widget.prepareForTransition("ToBack");
    
    front.style.display = "none";
    back.style.display = "block";
    
    SaveSettings();
    setTimeout("widget.performTransition(); document.getElementById('infoButton').style.display = 'block';", 0);
}


// -- PerformLookup --
//
// Perform a city lookup now and save the settings
//
function PerformLookup(executeNow)
{
    // Save preferences.
    
    region = document.getElementById('country').options[document.getElementById('country').selectedIndex].value;
    widget.setPreferenceForKey(region, widget.identifier + '-selectedRegion');
    
    if (region == 'US')
    {
        //region += '%2f';
        region += '/';
        state = document.getElementById('state').options[document.getElementById('state').selectedIndex].value
        region += state;
        widget.setPreferenceForKey(state, widget.identifier + '-selectedState');
    }
    
    name = document.getElementById('city').value;
    widget.setPreferenceForKey(name, widget.identifier + '-selectedName');
    
    twilightZenith = document.getElementById('twilight').value;
    widget.setPreferenceForKey(twilightZenith, widget.identifier + '-twilightZenith');
    
    
    // Start location lookup.
/*
    url = 'http://captaindan.org/services/solplaces/?v=' + gVersion + '&r=' + region + '&n=' + name;

    if (gCityRequest) gCityRequest.abort();
    gCityRequest = new XMLHttpRequest();
    gCityRequest.onreadystatechange = CityRequestHandler;
    gCityRequest.open('GET', url, true);
    gCityRequest.send('');
*/
    if (gSavedSettings.country != document.getElementById('country').value
        || gSavedSettings.state != document.getElementById('state').value
        || gSavedSettings.city != document.getElementById('city').value)
    {
        var response = window.TimeZoneHelper.lookupPlaceInRegionWithName(region, name);
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
    
    front = document.getElementById("front");
    back  = document.getElementById("back");
    
    widget.prepareForTransition("ToFront");
    
    back.style.display = "none";
    front.style.display = "block";
    
    setTimeout("widget.performTransition(); WidgetDidShow();", 0);
    if (gClockOnly) window.resizeTo(149, window.innerHeight);
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
        target = 149;
        increment = -15;
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
    
    
    // Make sure width matches target.
    
    window.resizeTo(target, window.innerHeight);
    document.getElementById('bgCenter').style.width = String(target - 149) + 'px';
    document.getElementById('bgRight').style.left = String(target - 19) + 'px';
    document.getElementById('placeName').style.width = String(target - 48) + 'px';
    
    
    // Show and hide some elements.
    
    if (gClockOnly)
        document.getElementById('bandAid').style.display = 'block';
    else
        document.getElementById('tableWrapper').style.display = 'table';
        
    document.getElementById('infoButton').style.display = 'block';
    TwilightDidChange();
}


// -- WidgetDidLoad --
//
// Handles onload event for the widget. Initializes interface elements,
// creating buttons and installing localized strings. Loads or creates
// preferences. Sets up widget event handlers.
//
function WidgetDidLoad()
{   
    // Do any locale-specific initialization that might need to be performed.
    // (In particular, the German and Dutch localizations need to widen the window.)
    
    if (window.LocaleInit) LocaleInit();
    gExpandedWidth = window.innerWidth;
    
    
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
    
    if (gClockOnly)
    {
        document.getElementById('bandAid').style.display = 'block';
        document.getElementById('tableWrapper').style.display = 'none';
        window.resizeTo(149, window.innerHeight);
        document.getElementById('bgCenter').style.width = '0px';
        document.getElementById('bgRight').style.left = '130px';
        document.getElementById('placeName').style.width = '101px';
    }
    
    
    // Get location and time zone from preferences, or set to default.
    
    var name = widget.preferenceForKey(widget.identifier + '-name');
    var myCity = null;
    var myRegion = null;
    var myState = null;
    
    if (name)
    {
        gLatitude  = widget.preferenceForKey(widget.identifier + '-latitude');
        gLongitude = widget.preferenceForKey(widget.identifier + '-longitude');
        window.TimeZoneHelper.setTimeZoneWithName(widget.preferenceForKey(widget.identifier + '-timeZone'));
    }
    else
    {
        name       = 'Cupertino';
        gLatitude  =   37.32306;
        gLongitude = -122.03111;
        window.TimeZoneHelper.setTimeZoneWithName('US/Pacific');
            
        myCity   = window.TimeZoneHelper.myCityName();
        myRegion = window.TimeZoneHelper.myRegionCode();
    }
    
    SetText('placeName', name);
    gTimeOffset = window.TimeZoneHelper.timeOffsetHours();
    
    if (myCity && myRegion)
    {
/*
        re = /\//;
        urlRegion = myRegion.replace(re, '%2f');
        
        url = 'http://captaindan.org/services/solplaces/?v=' + gVersion + '&r=' + urlRegion + '&n=' + myCity;

        if (gCityRequest) gCityRequest.abort();
        gCityRequest = new XMLHttpRequest();
        gCityRequest.onreadystatechange = CityRequestHandler;
        gCityRequest.open('GET', url, true);
        gCityRequest.send('');
*/
        var response = window.TimeZoneHelper.lookupPlaceInRegionWithName(myRegion, myCity);
        gCityRequest = {};
        gCityRequest.readyState = 4;
        gCityRequest.status = 200;
        gCityRequest.responseXML = (new DOMParser()).parseFromString(response, 'text/xml');
        if (gCityRequest.responseXML) setTimeout("CityRequestHandler();", 0);

        if (myRegion.slice(0, 2) == 'US')
        {
            myState = myRegion.slice(3);
            myRegion = 'US';
        }
        
        document.getElementById('country').value = myRegion;
        CountryDidChange();
        if (myState) document.getElementById('state').value = myState;
        document.getElementById('city').value = myCity;
    }
    
    
    // Set displayed preferences.
    
    selectedRegion = widget.preferenceForKey(widget.identifier + '-selectedRegion');
    selectedState  = widget.preferenceForKey(widget.identifier + '-selectedState');
    selectedCity   = widget.preferenceForKey(widget.identifier + '-selectedName');
    twilightZenith = widget.preferenceForKey(widget.identifier + '-twilightZenith');
    
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
    
    
    // Install event handlers. (The onshow event fires immediately after this
    // function returns.)
    
    widget.onshow   = WidgetDidShow;
    widget.onhide   = WidgetDidHide;
    widget.onremove = WidgetWillRemove;
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
    var countryMenu = document.getElementById('country');
    var countryIndex;
    var city, state;

    if (isBackSide())
    {
        countryIndex = gSavedSettings.countryIndex;
        city = gSavedSettings.city;
        state = gSavedSettings.state;
    }
    else
    {
        countryIndex = countryMenu.selectedIndex;
        city = document.getElementById('city').value;
        state = document.getElementById('state').value;
    }

    if (countryMenu.options[countryIndex].value == 'US')
    {
        return city + ', ' + state;
    }
    else
    {
        return city + ', ' + countryMenu.options[countryIndex].text;
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
    return 'http://maps.google.com/maps?q='
        + gLatitude + ',' + gLongitude
        + '+(' + encodeMapQuery(getLocationName()) + ')'
        + '&mrt=ds&z=13';
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
