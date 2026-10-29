package com.izforge.izpack.installer.bench.security;

import com.izforge.izpack.api.data.Blockable;
import com.izforge.izpack.api.data.OverrideType;
import com.izforge.izpack.api.data.PackInfo;
import com.izforge.izpack.installer.bench.support.InstallerFixture;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static org.junit.Assert.assertFalse;

/**
 * A relocation value carried by compiled metadata must not place an entry outside the
 * installation directory.
 */
public class LooseRelocationSecurityTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void relocatedEntryDoesNotEscapeInstallDirectory() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        File src = InstallerFixture.source("loosesrc", "loose-owned");
        Map<String, String> additionals = new HashMap<>();
        additionals.put("installTarget", "../escape/loose.txt");
        PackInfo pack = fixture.pack("pack1", true);
        pack.addFile(src.getParentFile(), src, "${INSTALL_PATH}/loose.txt", null, OverrideType.OVERRIDE_TRUE,
                     null, Blockable.BLOCKABLE_NONE, additionals, null, null);
        File escapeDir = new File(fixture.root(), "escape");
        if (!escapeDir.mkdirs() && !escapeDir.isDirectory())
        {
            throw new java.io.IOException("cannot create outside directory");
        }
        fixture.prepare(Collections.singletonList(pack));

        fixture.unpacker().run();

        assertFalse(new File(escapeDir, "loose.txt").exists());
    }
}
