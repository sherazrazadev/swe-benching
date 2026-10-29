package com.izforge.izpack.installer.bench.functional;

import com.izforge.izpack.api.data.Blockable;
import com.izforge.izpack.api.data.OverrideType;
import com.izforge.izpack.api.data.PackFile;
import com.izforge.izpack.installer.bench.support.InstallerFixture;
import org.junit.Test;

import java.io.File;

/**
 * The public file-entry interface keeps accepting ordinary nested and absolute targets.
 */
public class FileEntryApiFunctionalTest
{
    private static PackFile construct(String target) throws Exception
    {
        File src = InstallerFixture.source("apifunc", "a");
        return new PackFile(src.getParentFile(), src, target, null, OverrideType.OVERRIDE_TRUE,
                            null, Blockable.BLOCKABLE_NONE, null);
    }

    @Test
    public void acceptsNestedTarget() throws Exception
    {
        construct("subdir/file.txt");
    }

    @Test
    public void acceptsAbsoluteTargetOutsideBase() throws Exception
    {
        construct("/etc/myapp/config.properties");
    }
}
