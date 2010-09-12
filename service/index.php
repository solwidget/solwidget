<?php

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