<?php

// Copyright (c) 2006 Daniel S. Neumeyer
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//  * Redistributions of source code must retain the above copyright notice,
//    this list of conditions and the following disclaimer.
//  * Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//  * The name of the author may not be used to endorse or promote products
//    derived from this software without specific prior written permission.
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

    error_reporting(0);
    
    function fail()
    {
        print('<s></s>');
        exit();
    }
    
    
    // Check arguments.
    
    $region = $_GET['r'];
    $name   = $_GET['n'];
    
    preg_replace('/^\s+|\s+$/', '', $region);
    preg_replace('/^\s+|\s+$/', '', $name);
    
    if ($region == '' && $name == '')
    {
        include "api.html";
        exit();
    }
    
    // Declare content type.
    
    header('Content-type: text/xml; charset=utf-8', true);
    
    
    // Continue checking arguments.
    
    if ($region == '' || $name == '')
        fail();
    
    
    // Connect to database.
    
    $db = mysql_pconnect('xxx', 'xxx', 'xxx');
    
    if (! $db)
        fail();
    
    if (! mysql_select_db('xxx'))
        fail();
    
    
    // Search for locations.
    
    $name = mysql_real_escape_string(mb_strtoupper($name), $db);
    
    $query = "SELECT name, latitude, longitude, time_zone FROM sol_places WHERE region = '";
    $query .= mysql_real_escape_string($region, $db);
    $query .= "' AND (uc_name = '";
    $query .= $name;
    $query .= "' OR uc_alt_name = '";
    $query .= $name;
    $query .= "')";
    
    $sth = mysql_query($query, $db);
    
    
    // Send results.
    
    print('<s>');
    
    $row = $firstRow = mysql_fetch_row($sth);
    if ($row)
    {
        do
        {
            print('<r><n>');
            print($row[0]);
            print('</n><a>');
            print($row[1]);
            print('</a><o>');
            print($row[2]);
            print('</o><t>');
            print($row[3]);
            print('</t></r>');
        }
        while ($row = mysql_fetch_row($sth));
        
        $query = "INSERT INTO sol_results (created, name, region, latitude, longitude, time_zone) VALUES (now(), '";
        $query .= mysql_real_escape_string($firstRow[0], $db);
        $query .= "', '";
        $query .= mysql_real_escape_string($region, $db);
        $query .= "', ";
        $query .= $firstRow[1];
        $query .= ", ";
        $query .= $firstRow[2];
        $query .= ", '";
        $query .= mysql_real_escape_string($firstRow[3], $db);
        $query .= "')";
        
        mysql_query($query, $db);
    }
    
    print('</s>');
    
?>