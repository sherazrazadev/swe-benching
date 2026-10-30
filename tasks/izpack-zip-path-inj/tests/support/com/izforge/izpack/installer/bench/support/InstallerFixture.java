package com.izforge.izpack.installer.bench.support;

import com.izforge.izpack.api.data.InstallData;
import com.izforge.izpack.api.data.Info;
import com.izforge.izpack.api.data.Pack;
import com.izforge.izpack.api.data.PackCompression;
import com.izforge.izpack.api.data.PackFile;
import com.izforge.izpack.api.data.PackInfo;
import com.izforge.izpack.api.data.Variables;
import com.izforge.izpack.api.data.XPackFile;
import com.izforge.izpack.api.event.ProgressListener;
import com.izforge.izpack.api.handler.Prompt;
import com.izforge.izpack.api.resource.Messages;
import com.izforge.izpack.api.rules.RulesEngine;
import com.izforge.izpack.api.substitutor.VariableSubstitutor;
import com.izforge.izpack.core.io.FileSpanningOutputStream;
import com.izforge.izpack.core.io.VolumeLocator;
import com.izforge.izpack.installer.data.UninstallData;
import com.izforge.izpack.installer.event.InstallerListeners;
import com.izforge.izpack.installer.multiunpacker.MultiVolumeUnpacker;
import com.izforge.izpack.installer.unpacker.FileQueueFactory;
import com.izforge.izpack.installer.unpacker.PackResources;
import com.izforge.izpack.installer.unpacker.Unpacker;
import com.izforge.izpack.util.Housekeeper;
import com.izforge.izpack.util.PlatformModelMatcher;
import org.junit.rules.TemporaryFolder;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.ObjectOutputStream;
import java.io.Reader;
import java.io.Writer;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Drives the real installer entry point for the benchmark tests.
 *
 * <p>Builds the installer's packaged metadata (a serialised pack list, exactly as the
 * installer reads it at run time) and runs the real installer implementation over it with
 * real pack resources. Expected values are literals supplied by the test; this class only
 * builds inputs and drives the entry point.</p>
 */
public class InstallerFixture
{
    private static final Pattern VARIABLE = Pattern.compile("\\$\\{([A-Za-z0-9_.-]+)}");

    private final TemporaryFolder tmp;
    private final File installDir;
    private final Map<String, String> variables = new HashMap<>();

    private byte[] packPayload = "packed-content".getBytes(StandardCharsets.UTF_8);
    private byte[] volumesBytes;
    private File mediaPath;

    private InstallData installData;
    private PackResources resources;
    private final UninstallData uninstallData = new UninstallData();

    public InstallerFixture(TemporaryFolder tmp) throws IOException
    {
        this.tmp = tmp;
        this.installDir = new File(tmp.getRoot(), "install");
        if (!installDir.mkdirs() && !installDir.isDirectory())
        {
            throw new IOException("cannot create install directory");
        }
    }

    public File root()
    {
        return tmp.getRoot();
    }

    public File installDir()
    {
        return installDir;
    }

    /** Registers a value substituted into declared locations at run time. */
    public void variable(String name, String value)
    {
        variables.put(name, value);
    }

    /** Sets the byte content carried for a packaged file entry. */
    public void payload(String content)
    {
        packPayload = content.getBytes(StandardCharsets.UTF_8);
    }

    public PackInfo pack(String name, boolean loose)
    {
        return new PackInfo(name, name, name, true, loose, null, false, 0);
    }

    public static File source(String prefix, String content) throws IOException
    {
        File file = File.createTempFile(prefix, ".src");
        file.deleteOnExit();
        Files.write(file.toPath(), content.getBytes(StandardCharsets.UTF_8));
        return file;
    }

    /** Replaces the target stored in the pack file, as a crafted compiled installer would carry it. */
    public static void target(PackFile file, String target) throws Exception
    {
        field(file, "targetPath", target);
    }

    /**
     * Replaces a metadata field directly, as a crafted compiled installer would carry it.
     * Deserialisation does not run constructors or setters, so this is how metadata that is
     * not produced through the compile-time interface must be modelled.
     */
    public static void field(Object object, String name, Object value) throws Exception
    {
        Class<?> type = object.getClass();
        while (type != null)
        {
            try
            {
                Field field = type.getDeclaredField(name);
                field.setAccessible(true);
                field.set(object, value);
                return;
            }
            catch (NoSuchFieldException exception)
            {
                type = type.getSuperclass();
            }
        }
        throw new NoSuchFieldException(name);
    }

    /** Adds an entry to a pack with its archive position, as multi-volume media carry it. */
    @SuppressWarnings("unchecked")
    public static void addArchived(PackInfo pack, XPackFile file, File src) throws Exception
    {
        Field field = PackInfo.class.getDeclaredField("files");
        field.setAccessible(true);
        ((Map<PackFile, File>) field.get(pack)).put(file, src);
    }

    /** Builds a single-volume medium holding the given content, and its volume metadata. */
    public void useVolume(String volumeName, String content) throws IOException
    {
        mediaPath = new File(tmp.getRoot(), "media");
        if (!mediaPath.mkdirs() && !mediaPath.isDirectory())
        {
            throw new IOException("cannot create media directory");
        }
        File volume = new File(mediaPath, volumeName);
        try (FileSpanningOutputStream out = new FileSpanningOutputStream(volume, 1024 * 1024))
        {
            out.write(content.getBytes(StandardCharsets.UTF_8));
        }
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ObjectOutputStream objects = new ObjectOutputStream(bytes);
        objects.writeInt(1);
        objects.writeUTF(volumeName);
        objects.close();
        volumesBytes = bytes.toByteArray();
    }

    /**
     * Serialises the packs exactly as the toolkit compiles them into an installer, then sets
     * up the installer's collaborators.
     */
    public void prepare(List<PackInfo> packs) throws IOException
    {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ObjectOutputStream objects = new ObjectOutputStream(bytes);
        objects.writeObject(packs);
        objects.close();
        final byte[] packsBytes = bytes.toByteArray();

        installData = mock(InstallData.class);
        Variables vars = mock(Variables.class);
        when(vars.replace(anyString())).thenAnswer(invocation ->
                substitute((String) invocation.getArgument(0)));
        when(installData.getVariables()).thenReturn(vars);
        Messages messages = mock(Messages.class);
        when(messages.get(anyString())).thenReturn("message");
        when(installData.getMessages()).thenReturn(messages);
        when(installData.getInstallPath()).thenReturn(installDir.getAbsolutePath());
        if (mediaPath != null)
        {
            when(installData.getMediaPath()).thenReturn(mediaPath.getAbsolutePath());
        }
        Info info = mock(Info.class);
        when(info.isWriteInstallationInformation()).thenReturn(false);
        when(info.getCompressionFormat()).thenReturn(PackCompression.DEFAULT);
        when(installData.getInfo()).thenReturn(info);
        List<Pack> selected = new ArrayList<>();
        for (PackInfo pack : packs)
        {
            selected.add(pack.getPack());
        }
        when(installData.getSelectedPacks()).thenReturn(selected);

        resources = mock(PackResources.class);
        when(resources.getInputStream(anyString())).thenAnswer(invocation -> {
            String name = invocation.getArgument(0);
            if ("packs.info".equals(name))
            {
                return new ByteArrayInputStream(packsBytes);
            }
            if ("volumes.info".equals(name) && volumesBytes != null)
            {
                return new ByteArrayInputStream(volumesBytes);
            }
            return new ByteArrayInputStream(new byte[0]);
        });
        when(resources.getPackStream(anyString())).thenAnswer(
                invocation -> new ByteArrayInputStream(packPayload));
    }

    private String substitute(String value)
    {
        Map<String, String> values = new HashMap<>(variables);
        values.put("INSTALL_PATH", installDir.getAbsolutePath());
        Matcher matcher = VARIABLE.matcher(value);
        StringBuffer out = new StringBuffer();
        while (matcher.find())
        {
            String replacement = values.get(matcher.group(1));
            matcher.appendReplacement(out, Matcher.quoteReplacement(
                    replacement != null ? replacement : matcher.group(0)));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    /** Records the files the installer believes it installed, exactly as a real run does. */
    public UninstallData uninstallData()
    {
        return uninstallData;
    }

    public Unpacker unpacker() throws Exception
    {
        Unpacker unpacker = new Unpacker(installData, resources, rules(), substitutor(),
                                         uninstallData, queue(), mock(Housekeeper.class),
                                         mock(InstallerListeners.class), mock(Prompt.class), matcher());
        unpacker.setProgressListener(mock(ProgressListener.class));
        return unpacker;
    }

    public MultiVolumeUnpacker multiVolumeUnpacker() throws Exception
    {
        MultiVolumeUnpacker unpacker = new MultiVolumeUnpacker(
                installData, resources, rules(), substitutor(), uninstallData, queue(),
                mock(Housekeeper.class), mock(InstallerListeners.class), mock(Prompt.class),
                mock(VolumeLocator.class), matcher());
        unpacker.setProgressListener(mock(ProgressListener.class));
        return unpacker;
    }

    private RulesEngine rules()
    {
        RulesEngine rules = mock(RulesEngine.class);
        when(rules.isConditionTrue(anyString())).thenReturn(true);
        return rules;
    }

    private FileQueueFactory queue()
    {
        FileQueueFactory queue = mock(FileQueueFactory.class);
        when(queue.isSupported()).thenReturn(false);
        return queue;
    }

    private PlatformModelMatcher matcher()
    {
        PlatformModelMatcher matcher = mock(PlatformModelMatcher.class);
        when(matcher.matchesCurrentPlatform(
                org.mockito.ArgumentMatchers.<List<com.izforge.izpack.api.data.binding.OsModel>>any()))
                .thenReturn(true);
        return matcher;
    }

    private VariableSubstitutor substitutor() throws Exception
    {
        VariableSubstitutor substitutor = mock(VariableSubstitutor.class);
        org.mockito.Mockito.doAnswer(invocation -> {
            Reader reader = invocation.getArgument(0);
            Writer writer = invocation.getArgument(1);
            StringBuilder text = new StringBuilder();
            int c;
            while ((c = reader.read()) != -1)
            {
                text.append((char) c);
            }
            writer.write(text.toString().replace("ORIGINAL", "CHANGED"));
            return null;
        }).when(substitutor).substitute(org.mockito.ArgumentMatchers.<Reader>any(),
                                        org.mockito.ArgumentMatchers.<Writer>any(),
                                        org.mockito.ArgumentMatchers.any());
        return substitutor;
    }
}
