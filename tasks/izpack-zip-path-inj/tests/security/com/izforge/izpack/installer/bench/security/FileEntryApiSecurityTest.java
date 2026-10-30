package com.izforge.izpack.installer.bench.security;

import com.izforge.izpack.api.data.Blockable;
import com.izforge.izpack.api.data.OverrideType;
import com.izforge.izpack.api.data.PackFile;
import com.izforge.izpack.installer.bench.support.InstallerFixture;
import org.junit.Test;

import java.io.File;

import static org.junit.Assert.fail;

/**
 * The public file-entry interface used while compiling a description must refuse a target
 * that climbs out through a parent-directory segment, whichever separator spells it.
 */
public class FileEntryApiSecurityTest
{
    private static PackFile construct(String target) throws Exception
    {
        File src = InstallerFixture.source("apisrc", "a");
        return new PackFile(src.getParentFile(), src, target, null, OverrideType.OVERRIDE_TRUE,
                            null, Blockable.BLOCKABLE_NONE, null);
    }

    @Test
    public void refusesForwardSlashTraversal() throws Exception
    {
        refuse("sub/../escape.txt");
    }

    @Test
    public void refusesBackslashTraversal() throws Exception
    {
        refuse("sub\\..\\escape.txt");
    }

    private static void refuse(String target) throws Exception
    {
        try
        {
            construct(target);
            fail("a traversing target was accepted");
        }
        catch (Exception expected)
        {
            // refused
        }
    }
}
