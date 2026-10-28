<?php

namespace CweBench\SchemaOrg;

/**
 * Reads an emitted fragment the way a browser does: one script element with a
 * type attribute, an optional nonce attribute, and a JSON body.
 */
final class ScriptBlock
{
    /**
     * @return array{attributes: array<string, string>, body: string, data: array}
     */
    public static function parse(string $fragment): array
    {
        $document = new \DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $loaded = $document->loadHTML(
            '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>'.$fragment.'</body></html>',
            LIBXML_NOWARNING | LIBXML_NOERROR
        );
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if (! $loaded) {
            throw new \RuntimeException('the emitted fragment is not parseable HTML');
        }

        $scripts = $document->getElementsByTagName('script');

        if ($scripts->length !== 1) {
            throw new \RuntimeException('expected exactly one script element, found '.$scripts->length);
        }

        $script = $scripts->item(0);
        $attributes = [];

        if ($script->attributes !== null) {
            foreach ($script->attributes as $attribute) {
                $attributes[$attribute->nodeName] = $attribute->nodeValue;
            }
        }

        $body = $script->textContent;
        $data = json_decode($body, true);

        if (! is_array($data)) {
            throw new \RuntimeException('the script body is not a JSON object');
        }

        return ['attributes' => $attributes, 'body' => $body, 'data' => $data];
    }
}
